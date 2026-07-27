import Link from "next/link";
import { Bike } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-background to-amber-50 p-4 dark:from-blue-950/30 dark:to-amber-950/20">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-xl shadow-blue-950/5">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-blue-700 text-white"
            aria-label="Bike Buddy home"
          >
            <Bike className="size-7" />
          </Link>
          <CardTitle className="text-2xl text-blue-700 dark:text-blue-300">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          {footer && (
            <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
