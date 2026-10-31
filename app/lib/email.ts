import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendOrderConfirmationEmail(
  customerEmail: string,
  customerName: string,
  orderRef: string,
  total: number,
  requestedDate: string,
  boxDetails: string
) {
  // The bank details (you can also fetch these from Supabase settings later)
  const bankDetails = `
    Bank: FNB
    Account Name: Pulp
    Account Number: 123456789
    Branch Code: 250655
  `;

  const depositAmount = total * 0.5; // Assuming 50% deposit

  const mailOptions = {
    from: `"Pulp" <${process.env.GMAIL_USER}>`,
    to: customerEmail,
    cc: process.env.GMAIL_USER, // CC's your wife so she gets a copy
    subject: `Order Received: ${orderRef} - Action Required`,
    html: `
      <div style="font-family: Georgia, serif; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="text-align: center; letter-spacing: 4px;">PULP</h1>
        <p style="text-align: center;">Illusion Collection</p>
        <hr style="border: none; border-top: 1px solid #111; width: 50px; margin: 20px auto;" />
        
        <p>Hi ${customerName},</p>
        <p>Thank you for your order! Here are the details:</p>
        
        <ul style="list-style: none; padding: 0;">
          <li><strong>Order Reference:</strong> ${orderRef}</li>
          <li><strong>Date Required:</strong> ${requestedDate}</li>
          <li><strong>Details:</strong> ${boxDetails}</li>
          <li><strong>Total:</strong> R${total.toFixed(2)}</li>
        </ul>

        <div style="background-color: #FDF6E9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">To confirm your order, please pay a 50% deposit (R${depositAmount.toFixed(2)}) within 24 hours:</h3>
          <pre style="font-family: monospace; font-size: 14px; white-space: pre-wrap;">${bankDetails}</pre>
          <p><strong>IMPORTANT:</strong> Please use <strong>${orderRef}</strong> as your payment reference.</p>
        </div>

        <p>Once payment is received, your order status will change to confirmed.</p>
        <p>Warm regards,<br/>The Pulp Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}