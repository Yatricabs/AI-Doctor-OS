"use client";

import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "./workspaceStore";

/** Typed hooks keep Redux usage safe and avoid repeating store-specific generics. */
export const useWorkspaceDispatch = () => useDispatch<AppDispatch>();
export const useWorkspaceSelector: TypedUseSelectorHook<RootState> = useSelector;
