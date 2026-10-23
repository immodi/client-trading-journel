import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "default" | "positive" | "negative";

const toneClasses: Record<Tone, string> = {
    default: "",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
};

interface StatCardProps {
    label: string;
    value: string;
    hint?: string;
    icon?: ReactNode;
    tone?: Tone;
}

export function StatCard({ label, value, hint, icon, tone = "default" }: StatCardProps) {
    return (
        <Card size="sm">
            <CardContent className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium tracking-wide uppercase">
                        {label}
                    </span>
                    {icon}
                </div>

                <span className={cn("text-2xl font-semibold tracking-tight", toneClasses[tone])}>
                    {value}
                </span>

                <span className="text-xs text-muted-foreground">{hint ?? "\u00a0"}</span>
            </CardContent>
        </Card>
    );
}
