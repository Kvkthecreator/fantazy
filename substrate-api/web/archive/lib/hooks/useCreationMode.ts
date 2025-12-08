import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export type CreationMode = "wizard" | "blank";

export function useCreationMode() {
    const searchParams = useSearchParams();
    const [mode, setModeState] = useState<CreationMode>("wizard");

    useEffect(() => {
        const param = searchParams?.get("mode");
        let initial: CreationMode | null = null;
        if (param === "wizard" || param === "blank") {
            initial = param;
        } else if (typeof window !== "undefined") {
            const stored = localStorage.getItem("rn-create-mode");
            if (stored === "wizard" || stored === "blank") {
                initial = stored as CreationMode;
            }
        }
        setModeState(initial ?? "wizard");
    }, [searchParams]);

    const setMode = (m: CreationMode) => {
        setModeState(m);
        if (typeof window !== "undefined") {
            localStorage.setItem("rn-create-mode", m);
        }
    };

    return { mode, setMode };
}
