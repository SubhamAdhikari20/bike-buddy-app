"use client";

// Support ticket queue (SUP-04): riders can see these same statuses in
// the app, so updating them here closes the loop.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText, SearchCheck } from "lucide-react";
import { toast } from "sonner";
import { TableActionsMenu } from "@/components/table-actions-menu";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

type Ticket = {
  _id: string;
  type: "breakdown" | "complaint" | "general";
  subject: string;
  message: string;
  status: "open" | "in_review" | "resolved";
  rating?: number | null;
  priority: "normal" | "high";
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
  const [selected, setSelected] = useState<Ticket | null>(null);

  const load = useCallback(() => {
    api
      .get<Ticket[]>("/support/tickets")
      .then((res) => setTickets(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const setStatus = async (
    ticketId: string,
    status: "in_review" | "resolved",
  ) => {
    try {
      await api.patch<Ticket>(`/support/tickets/${ticketId}/status`, {
        status,
      });
      toast.success(
        status === "in_review" ? "Ticket review started" : "Ticket resolved",
        {
          description:
            "The renter sees this status update in their support history.",
        },
      );
      load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update the ticket.";
      setError(message);
      toast.error("Ticket status was not changed", { description: message });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">
          High-priority breakdown tickets are shown first. Response time is not
          guaranteed.
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
                      <span className="capitalize text-muted-foreground">
                        {ticket.type}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {ticket.subject}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {ticket.message}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
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
                  <TableCell>
                    {ticket.rating ? `${ticket.rating}/5` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableActionsMenu
                      label={`Actions for ticket ${ticket._id.slice(-6)}`}
                      actions={[
                        {
                          label: "View details",
                          icon: <FileText aria-hidden="true" />,
                          onSelect: () => setSelected(ticket),
                        },
                        {
                          label: "Start review",
                          icon: <SearchCheck aria-hidden="true" />,
                          disabled: ticket.status !== "open",
                          separatorBefore: true,
                          onSelect: () => setStatus(ticket._id, "in_review"),
                        },
                        {
                          label: "Resolve",
                          icon: <CheckCircle2 aria-hidden="true" />,
                          disabled: ticket.status !== "in_review",
                          confirmation: {
                            title: `Resolve ${ticket.subject}?`,
                            description:
                              "This closes the support workflow for the renter. Confirm that the request has been addressed.",
                            confirmLabel: "Resolve ticket",
                          },
                          onSelect: () => setStatus(ticket._id, "resolved"),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
            <DialogDescription>
              Ticket #{selected?._id.slice(-6).toUpperCase()} · {selected?.type}{" "}
              · {selected?.status.replace("_", " ")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="whitespace-pre-wrap leading-6">{selected?.message}</p>
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="capitalize font-medium">{selected?.priority}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rating</dt>
                <dd className="font-medium">
                  {selected?.rating ? `${selected.rating}/5` : "Not rated"}
                </dd>
              </div>
            </dl>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
