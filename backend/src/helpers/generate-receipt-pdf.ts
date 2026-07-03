// backend/src/helpers/generate-receipt-pdf.ts
import PDFDocument from "pdfkit";
import type { Response } from "express";

type ReceiptData = {
    receiptNumber: string;
    issuedAt: Date;
    renterName: string;
    bikeTitle: string;
    startDate: Date;
    endDate: Date;
    pickupLocation: string;
    breakdown: {
        pricePerDay: number;
        rentalDays: number;
        baseAmount: number;
        serviceFee: number;
        securityDeposit: number;
        total: number;
    };
    paymentProvider?: string | null;
    paymentStatus: string;
};

const npr = (amount: number) => `NPR ${amount.toLocaleString("en-US")}`;

const nptDate = (date: Date) => {
    const npt = new Date(date.getTime() + (5 * 60 + 45) * 60 * 1000);
    return npt.toISOString().replace("T", " ").slice(0, 16) + " NPT";
};

/// Streams a simple branded receipt PDF straight to the response
/// (PR-04, RET-04 - proof of every transaction).
export const streamReceiptPdf = (res: Response, data: ReceiptData) => {
    const doc = new PDFDocument({ size: "A5", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename=bike-buddy-receipt-${data.receiptNumber}.pdf`,
    );
    doc.pipe(res);

    doc.fillColor("#1A56DB").fontSize(22).font("Helvetica-Bold").text("Bike Buddy");
    doc.fillColor("#6B7280").fontSize(9).font("Helvetica").text("Motorbike rentals for Nepal - bikebuddy.com.np");
    doc.moveDown(1);

    doc.fillColor("#111928").fontSize(14).font("Helvetica-Bold").text("Payment Receipt");
    doc.fontSize(9).font("Helvetica").fillColor("#6B7280");
    doc.text(`Receipt #: ${data.receiptNumber}`);
    doc.text(`Issued: ${nptDate(data.issuedAt)}`);
    doc.text(`Rider: ${data.renterName}`);
    doc.moveDown(1);

    doc.fillColor("#111928").fontSize(11).font("Helvetica-Bold").text(data.bikeTitle);
    doc.fontSize(9).font("Helvetica").fillColor("#6B7280");
    doc.text(`From: ${nptDate(data.startDate)}`);
    doc.text(`To: ${nptDate(data.endDate)}`);
    doc.text(`Pickup: ${data.pickupLocation}`);
    doc.moveDown(1);

    const line = (label: string, value: string, bold = false) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(bold ? 11 : 9)
            .fillColor(bold ? "#111928" : "#374151");
        const y = doc.y;
        doc.text(label, 40, y);
        doc.text(value, 40, y, { align: "right" });
        doc.moveDown(0.4);
    };

    line(
        `Rental (${data.breakdown.rentalDays} day${data.breakdown.rentalDays > 1 ? "s" : ""} x ${npr(data.breakdown.pricePerDay)})`,
        npr(data.breakdown.baseAmount),
    );
    line("Service fee", npr(data.breakdown.serviceFee));
    if (data.breakdown.securityDeposit > 0) {
        line("Refundable deposit (returned after the ride)", npr(data.breakdown.securityDeposit));
    }
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor("#E5E7EB").stroke();
    doc.moveDown(0.4);
    line("Total paid", npr(data.breakdown.total), true);

    doc.moveDown(1);
    doc.fontSize(8).font("Helvetica").fillColor("#6B7280");
    doc.text(`Payment method: ${data.paymentProvider ?? "N/A"} - status: ${data.paymentStatus}`);
    doc.text("No hidden fees. Questions? Call our 24/7 support: +977-9800000000");

    doc.end();
};
