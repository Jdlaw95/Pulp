"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OrderItem = {
  flavor_breakdown: { [key: string]: number };
  unit_price_zar: number;
};

type Order = {
  id: string;
  order_ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  requested_date: string;
  total_zar: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`*, order_items (flavor_breakdown, unit_price_zar)`)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setOrders(data as Order[]);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/admin/login");
      else {
        await fetchOrders();
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);

    if (error) {
      alert("Failed: " + error.message);
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    }
    setUpdatingId(null);
  };

  const formatFlavors = (breakdown: any) => {
    if (!breakdown || Object.keys(breakdown).length === 0) return "No flavors selected";
    return Object.entries(breakdown)
      .filter(([_, count]) => count > 0)
      .map(([flavor, count]) => `${count}x ${flavor}`)
      .join(", ");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_payment": return { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" };
      case "confirmed": return { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" };
      case "ready": return { bg: "#F3E8FF", text: "#6B21A8", border: "#E9D5FF" };
      case "collected": return { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" };
      case "cancelled": return { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" };
      default: return { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" };
    }
  };

  if (loading) return <div style={{ padding: '2rem', fontFamily: 'serif' }}>Loading...</div>;

  return (
    <div style={{ backgroundColor: '#F3F4F6', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        
        {/* Header & Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ fontSize: '2rem', margin: 0, fontFamily: 'serif' }}>Pulp Admin</h1>
            <nav style={{ display: 'flex', gap: '1.5rem' }}>
              <span style={{ fontWeight: 'bold', borderBottom: '2px solid #111', paddingBottom: '0.25rem' }}>Orders</span>
              <a href="/admin/products" style={{ color: '#6B7280', textDecoration: 'none' }}>Products</a>
            </nav>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#6B7280', textDecoration: 'underline', cursor: 'pointer' }}>
            Logout
          </button>
        </div>

        {/* Orders List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.length === 0 ? (
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.75rem', textAlign: 'center', color: '#6B7280' }}>
              No orders yet.
            </div>
          ) : (
            orders.map((order) => {
              const statusColors = getStatusColor(order.status);
              const flavors = order.order_items?.[0]?.flavor_breakdown;

              return (
                <div key={order.id} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.125rem', backgroundColor: '#F3F4F6', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                        {order.order_ref}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '999px', backgroundColor: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}>
                        {order.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: '600', fontSize: '1rem' }}>{order.customer_name}</p>
                    <p style={{ margin: 0, color: '#6B7280', fontSize: '0.875rem' }}>{order.customer_email} | {order.customer_phone}</p>
                  </div>

                  {/* Order Details */}
                  <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div><strong>Date:</strong> {new Date(order.requested_date).toLocaleDateString('en-ZA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                    <div><strong>Flavors:</strong> {formatFlavors(flavors)}</div>
                    <div><strong>Total:</strong> R{order.total_zar.toFixed(2)}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase' }}>Update Status:</label>
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        disabled={updatingId === order.id}
                        style={{ padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #D1D5DB', backgroundColor: 'white', fontSize: '0.875rem' }}
                      >
                        <option value="pending_payment">Pending Deposit</option>
                        <option value="confirmed">Confirmed (Deposit Paid)</option>
                        <option value="ready">Ready for Collection</option>
                        <option value="collected">Collected / Complete</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {order.status === "pending_payment" && (
                      <button 
                        onClick={() => updateStatus(order.id, "confirmed")}
                        disabled={updatingId === order.id}
                        style={{ backgroundColor: '#111827', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}
                      >
                        Override: Cash Paid
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}