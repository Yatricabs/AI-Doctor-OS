from dataclasses import dataclass


@dataclass(frozen=True)
class PreferenceExample:
    prompt: str
    chosen: str
    rejected: str
    reason: str

    def validate(self) -> None:
        if (
            not all((self.prompt, self.chosen, self.rejected, self.reason))
            or self.chosen == self.rejected
        ):
            raise ValueError("Preference records require distinct chosen/rejected responses")
