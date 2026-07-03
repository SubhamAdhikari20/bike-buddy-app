"use client";

// Support ticket queue (SUP-04): riders can see these same statuses in
// the app, so updating them here closes the loop.
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

type Ticket = {
    _id: string;
    type: "breakdown" | "complaint" | "general";
    subject: string;
    message: string;
    status: "open" | "in_review" | "resolved";
    rating?: number | null;
    createdAt: string;
};

const statusBadge: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    in_review: "bg-amber-100 text-amber-700",
    resolved: "bg-green-100 text-green-700",
};

export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        api.get("/support/tickets")
            .then((res) => setTickets(res.data))
            .catch((err) => setError(err.message));
    }, []);

    useEffect(load, [load]);

    const setStatus = async (ticketId: string, status: string) => {
        try {
            await api.patch(`/support/tickets/${ticketId}/status`, { status });
            load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
                <p className="text-sm text-gray-500">
                    Breakdown tickets are the priority lane - 15 minute target.
                </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>Queue</CardTitle>
                    <CardDescription>{tickets.length} tickets</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tickets.map((ticket) => (
                                <TableRow key={ticket._id}>
                                    <TableCell>
                                        {ticket.type === "breakdown" ? (
                                            <Badge className="bg-orange-100 text-orange-700">
                                                breakdown
                                            </Badge>
                                        ) : (
                                            <span className="capitalize text-gray-600">{ticket.type}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                                    <TableCell className="max-w-xs truncate text-gray-500">
                                        {ticket.message}
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {new Date(ticket.createdAt).toLocaleString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={statusBadge[ticket.status]}>
                                            {ticket.status.replace("_", " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{ticket.rating ? `${ticket.rating}/5` : "-"}</TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        {ticket.status === "open" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setStatus(ticket._id, "in_review")}
                                            >
                                                Start review
                                            </Button>
                                        )}
                                        {ticket.status !== "resolved" && (
                                            <Button
                                                size="sm"
                                                className="bg-green-600 text-white hover:bg-green-700"
                                                onClick={() => setStatus(ticket._id, "resolved")}
                                            >
                                                Resolve
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
