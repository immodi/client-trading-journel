import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="text-2xl">Page not found</CardTitle>
                    <CardDescription>
                        The page you are looking for does not exist.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link
                        to="/"
                        className={cn(buttonVariants(), "w-full")}
                    >
                        <ArrowLeft />
                        Back to dashboard
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
