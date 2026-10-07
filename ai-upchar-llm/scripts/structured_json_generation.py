"""Ordered JSON generation for AI UPCHAR evaluation and inference.

The top-level object skeleton is deterministic.  The model still generates each
JSON value, while downstream evaluators retain ownership of clinical, safety,
non-empty-value, and repetition verdicts.
"""
from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any


STRUCTURED_DECODING_IMPLEMENTATION = (
    "ai-upchar-ordered-json-sequence-v2+literal-cache+lm-format-enforcer==0.11.3"
)


_TOKENIZER_ALLOWED_TOKEN_CACHES: dict[int, dict[Any, Any]] = {}


def _ordered_keys(expected: Mapping[str, Any]) -> list[str]:
    if not isinstance(expected, Mapping) or not expected:
        raise ValueError("Expected assistant contract must be a non-empty JSON object")
    keys = list(expected)
    if any(not isinstance(key, str) or not key for key in keys):
        raise ValueError("Structured JSON generation requires non-empty string keys")
    if len(set(keys)) != len(keys):
        raise ValueError("Structured JSON generation keys must be unique")
    return keys


def build_ordered_json_parser(
    expected: Mapping[str, Any], *, alphabet: str | None = None
):
    """Build a character parser with an exact top-level key sequence.

    ``JsonSchemaParser(force_json_field_order=True)`` is deliberately not used.
    V16 diagnostic v2 proved that lm-format-enforcer 0.11.3 could block the
    intended second key, causing key fragments to spill into a string before
    emitting a different valid key order.  Literal sequence parsers make braces,
    separators, key names, and key order non-negotiable while allowing any JSON
    value type, matching the unchanged frozen evaluator contract.
    """
    from lmformatenforcer import JsonSchemaParser
    from lmformatenforcer.characterlevelparser import (
        CharacterLevelParser,
        CharacterLevelParserConfig,
        SequenceParser,
        StringParser,
        UnionParser,
    )
    from lmformatenforcer.consts import COMPLETE_ALPHABET

    config = CharacterLevelParserConfig(
        alphabet=alphabet or COMPLETE_ALPHABET,
    )

    class LiteralParser(StringParser):
        """String parser whose incomplete literal state is safely cacheable."""

        def add_character(self, new_character: str) -> CharacterLevelParser:
            if self.target_str.startswith(new_character):
                return LiteralParser(self.target_str[len(new_character) :])
            return super().add_character(new_character)

        def cache_key(self):
            if self.target_str:
                return ("ordered-json-literal", self.target_str)
            return None

    class OrderedSequenceParser(SequenceParser):
        """Sequence parser that preserves LMFE's JSON free-text shortcut.

        LM Format Enforcer 0.11.3 only exposes ``json_freetext`` when a
        ``SequenceParser`` contains one parser.  A top-level ordered object
        necessarily contains the remaining literal keys, so the stock class
        returns ``None`` and TokenEnforcer recursively walks the whole Qwen
        vocabulary for every character in a value.  That is prohibitively
        slow with Qwen3's 151k vocabulary.

        The first parser is the only parser that can consume the next
        character unless it can end.  Delegating its shortcut is therefore
        equivalent to the stock parser while retaining the deterministic
        literal skeleton.  ``add_character`` returns this subclass so the
        optimization survives every generated character.
        """

        def add_character(self, new_character: str) -> CharacterLevelParser:
            legal_parsers = []
            for idx, parser in enumerate(self.parsers):
                if new_character in parser.get_allowed_characters():
                    updated_parser = parser.add_character(new_character)
                    next_parsers = [updated_parser] + self.parsers[idx + 1 :]
                    if len(next_parsers) == 1:
                        legal_parsers.append(next_parsers[0])
                    else:
                        legal_parsers.append(OrderedSequenceParser(next_parsers))
                if not parser.can_end():
                    break
            if len(legal_parsers) == 1:
                return legal_parsers[0]
            return UnionParser(legal_parsers)

        def shortcut_key(self):
            if not self.parsers:
                return None
            shortcut = self.parsers[0].shortcut_key()
            if not (
                isinstance(shortcut, tuple)
                and shortcut
                and shortcut[0] == "json_freetext"
            ):
                return shortcut
            current_parser = self.parsers[0]
            object_stack = getattr(current_parser, "object_stack", ())
            current_state = object_stack[-1] if object_stack else None
            parsed_string = getattr(current_state, "parsed_string", "")
            return (
                "ai_upchar_json_freetext",
                *shortcut[1:],
                parsed_string[-128:],
            )

        def cache_key(self):
            if not self.parsers or self.parsers[0].can_end():
                return None
            first_cache_key = self.parsers[0].cache_key()
            if first_cache_key is None:
                return None
            return ("ordered-json-first", first_cache_key)

    parsers = []
    for index, key in enumerate(_ordered_keys(expected)):
        separator = "{" if index == 0 else ","
        encoded_key = json.dumps(key, ensure_ascii=False, separators=(",", ":"))
        parsers.append(LiteralParser(f"{separator}{encoded_key}:"))
        # None means any syntactically valid JSON value.  This preserves the
        # frozen evaluator's heterogeneous value contract (for example some E12
        # outputs use a string where other cases use an array).
        parsers.append(JsonSchemaParser(None, config=config))
    parsers.append(LiteralParser("}"))
    return OrderedSequenceParser(parsers)


def build_json_prefix_allowed_tokens_fn(tokenizer: Any, expected: Mapping[str, Any]):
    """Build the Transformers token filter for one ordered output contract."""
    try:
        from lmformatenforcer.integrations.transformers import (
            build_token_enforcer_tokenizer_data,
        )
        from lmformatenforcer.tokenenforcer import TokenEnforcer
    except ImportError as exc:  # pragma: no cover - exercised by cloud preflight
        raise RuntimeError(
            "lm-format-enforcer==0.11.3 is required for validated JSON generation"
        ) from exc

    cache_attribute = "_ai_upchar_lmfe_tokenizer_data"
    tokenizer_data = getattr(tokenizer, cache_attribute, None)
    if tokenizer_data is None:
        tokenizer_data = build_token_enforcer_tokenizer_data(tokenizer)
        setattr(tokenizer, cache_attribute, tokenizer_data)

    # Build after tokenizer preprocessing so Hindi/Hinglish and other Unicode
    # characters present in the actual Qwen vocabulary remain legal in values.
    parser = build_ordered_json_parser(
        expected, alphabet=tokenizer_data.tokenizer_alphabet
    )
    key_names = tuple(_ordered_keys(expected))

    class GuardedTokenEnforcer(TokenEnforcer):
        """Keep model key fragments out of JSON string values.

        The normal LMFE JSON free-text shortcut intentionally allows almost
        every non-quote token.  That is syntactically safe, but a model that
        tries to continue its own object can emit fragments such as
        `,source_limit` or `,'source_limit':` inside the preceding value.  The
        top-level parser still produces valid JSON, yet the value is polluted.
        Filter only those exact contract-key fragments while retaining the
        fast free-text token cache for every other token.
        """

        def __init__(self, tokenizer_data, character_level_parser):
            super().__init__(tokenizer_data, character_level_parser)
            self.key_markers = tuple(
                "," + "".join(
                    character for character in key.casefold() if character.isalnum()
                )
                for key in key_names
            )
            self.marker_prefixes = tuple(
                prefix
                for marker in self.key_markers
                for prefix in (
                    marker[:index]
                    for index in range(1, len(marker) + 1)
                )
            )
            self.blocked_marker_prefixes = tuple(
                prefix for prefix in self.marker_prefixes if len(prefix) >= 5
            )
            self.bad_marker_token_ids = {
                token_id
                for token_id, token_text in self.tokenizer_tree.tokens_to_strs.items()
                if self.contains_blocked_marker_prefix(token_text)
            }

        @staticmethod
        def normalize_fragment(text: str) -> str:
            return "".join(
                character
                for character in text.casefold()
                if character == "," or character.isalnum()
            )

        def contains_key_fragment(self, text: str) -> bool:
            normalized = self.normalize_fragment(text)
            return self.contains_blocked_marker_prefix(normalized)

        def contains_blocked_marker_prefix(self, text: str) -> bool:
            normalized = self.normalize_fragment(text)
            return any(prefix in normalized for prefix in self.blocked_marker_prefixes)

        def token_contains_key_fragment(self, recent: str, token_id: int) -> bool:
            if token_id in self.bad_marker_token_ids:
                return True
            normalized_recent = self.normalize_fragment(recent)
            if not any(
                normalized_recent.endswith(prefix) for prefix in self.marker_prefixes
            ):
                return False
            token_text = self.tokenizer_tree.tokens_to_strs.get(token_id, "")
            return self.contains_key_fragment(recent + token_text)

        def _collect_allowed_tokens(
            self, parser, tree_node, allowed_tokens, shortcut_key
        ):
            if not (
                isinstance(shortcut_key, tuple)
                and shortcut_key
                and shortcut_key[0] == "ai_upchar_json_freetext"
            ):
                return super()._collect_allowed_tokens(
                    parser, tree_node, allowed_tokens, shortcut_key
                )

            _, cur_len, min_len, max_len, recent = shortcut_key
            allowed_tokens.extend(
                token_id
                for token_id in tree_node.tokens
                if not self.token_contains_key_fragment(recent, token_id)
            )
            allowed_characters = parser.get_allowed_characters()
            relevant_characters = tree_node.children.keys()
            characters_to_explore = set(relevant_characters).intersection(
                allowed_characters
            )

            cache = self.tokenizer_tree.json_freetext_tokens
            min_remaining = min(
                cache.max_token_len, max(0, min_len - cur_len)
            )
            max_allowed_len = min(cache.max_token_len, max_len - cur_len)
            candidates = cache.lookup_allowed_tokens(
                min_remaining, max_allowed_len
            ).allowed_tokens
            normalized_recent = self.normalize_fragment(recent)
            if any(
                normalized_recent.endswith(prefix) for prefix in self.marker_prefixes
            ):
                allowed_tokens.extend(
                    token_id
                    for token_id in candidates
                    if not self.token_contains_key_fragment(recent, token_id)
                )
            else:
                allowed_tokens.extend(candidates)
            characters_to_explore = characters_to_explore.intersection(['"'])
            for character in characters_to_explore:
                next_parser = parser.add_character(character)
                next_tree_node = tree_node.children[character]
                self._collect_allowed_tokens(
                    next_parser, next_tree_node, allowed_tokens, None
                )

    token_enforcer = GuardedTokenEnforcer(tokenizer_data, parser)
    cache = _TOKENIZER_ALLOWED_TOKEN_CACHES.setdefault(
        id(tokenizer_data), {}
    )
    token_enforcer.allowed_token_cache = cache

    class PrefixAllowedTokensFn:
        def __init__(self, enforcer):
            self.token_enforcer = enforcer

        def __call__(self, batch_id, sent):
            return self.token_enforcer.get_allowed_tokens(sent.tolist()).allowed_tokens

    return PrefixAllowedTokensFn(token_enforcer)
