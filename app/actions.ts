"use server";

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function submitOrder(formData: {
  name: string;
  email: string;
  phone: string;
  date: string;
  boxType: "Trio" | "Box of 6";
  flavors: { mango: number; strawberry: number; blueberry: number };
  total: number;
}) {
  try {
    // 1. Insert the order into Supabase
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        requested_date: formData.date,
        total_zar: formData.total,
        status: "pending_payment",
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    // 2. Format the flavor breakdown
    const flavorsText = Object.entries(formData.flavors)
      .filter(([_, count]) => count > 0)
      .map(([flavor, count]) => `${count}x ${flavor.charAt(0).toUpperCase() + flavor.slice(1)}`)
      .join(", ");
    
    const boxDetails = `${formData.boxType} (${flavorsText})`;

    // 3. Insert the order items (REPLACE THESE UUIDS WITH YOUR REAL SUPABASE IDs)
    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: orderData.id,
      product_id: formData.boxType === "Trio" ? "fbdef79c-569a-4321-884a-cfb25b5f31d5" : "40f13357-a558-418c-b57d-a15298cc796e", 
      quantity: 1,
      unit_price_zar: formData.total,
      flavor_breakdown: formData.flavors,
    });

    if (itemError) throw new Error(itemError.message);

    // 4. Send the Email directly from here
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const depositAmount = formData.total * 0.5;
    const bankDetails = `
      Bank: FNB
      Account Name: Pulp
      Account Number: 123456789
      Branch Code: 250655
    `;

    await transporter.sendMail({
      from: `"Pulp" <${process.env.GMAIL_USER}>`,
      to: formData.email,
      cc: process.env.GMAIL_USER, 
      subject: `Order Received: ${orderData.order_ref} - Action Required`,
      html: `
        <div style="font-family: Georgia, serif; color: #111; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="text-align: center; letter-spacing: 4px;">PULP</h1>
          <p style="text-align: center;">Illusion Collection</p>
          <hr style="border: none; border-top: 1px solid #111; width: 50px; margin: 20px auto;" />
          
          <p>Hi ${formData.name},</p>
          <p>Thank you for your order! Here are the details:</p>
          
          <ul style="list-style: none; padding: 0;">
            <li><strong>Order Reference:</strong> ${orderData.order_ref}</li>
            <li><strong>Date Required:</strong> ${formData.date}</li>
            <li><strong>Details:</strong> ${boxDetails}</li>
            <li><strong>Total:</strong> R${formData.total.toFixed(2)}</li>
          </ul>

          <div style="background-color: #FDF6E9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">To confirm your order, please pay a 50% deposit (R${depositAmount.toFixed(2)}) within 24 hours:</h3>
            <pre style="font-family: monospace; font-size: 14px; white-space: pre-wrap;">${bankDetails}</pre>
            <p><strong>IMPORTANT:</strong> Please use <strong>${orderData.order_ref}</strong> as your payment reference.</p>
          </div>

          <p>Once payment is received, your order status will change to confirmed.</p>
          <p>Warm regards,<br/>The Pulp Team</p>
        </div>
      `,
    });

    return { success: true, orderRef: orderData.order_ref };
  } catch (error: any) {
    console.error("Order submission failed:", error);
    return { success: false, error: error.message || "Something went wrong." };
  }
}