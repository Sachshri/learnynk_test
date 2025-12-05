import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Task = {
  id: string;
  type: string;
  status: string;
  related_id: string; 
  due_at: string;
};

export default function TodayDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    setLoading(true);
    setError(null);

    try {
        if (!supabase) {
        throw new Error("Supabase client is not initialized. Check your imports.");
        }
      // Calculate start and end of today for filtering
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .neq("status", "completed") // Filter out completed tasks
        .gte("due_at", todayStart.toISOString()) 
        .lte("due_at", todayEnd.toISOString())   
        .order("due_at", { ascending: true });

      if (error) throw error;

      setTasks(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function markComplete(id: string) {
    try {
      //  Updating UI immediately before API finishes
      setTasks((prev) => prev.filter((task) => task.id !== id));

      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", id);

      if (error) {
        throw error;
      }
      
      // await fetchTasks(); 
    } catch (err: any) {
      console.error(err);
      setError("Failed to update task status");
      fetchTasks(); 
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  if (loading) return <div style={{ padding: "2rem" }}>Loading tasks...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>Error: {error}</div>;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Today&apos;s Tasks</h1>
      
      {tasks.length === 0 ? (
        <p>No tasks due today </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f4f4f4" }}>
              <th style={{ padding: "10px" }}>Type</th>
              <th style={{ padding: "10px" }}>App ID (Related)</th>
              <th style={{ padding: "10px" }}>Due At</th>
              <th style={{ padding: "10px" }}>Status</th>
              <th style={{ padding: "10px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "10px", textTransform: "capitalize" }}>{t.type}</td>
                <td style={{ padding: "10px", fontFamily: "monospace" }}>{t.related_id}</td>
                <td style={{ padding: "10px" }}>
                  {new Date(t.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: "10px" }}>
                    <span style={{ 
                        padding: "4px 8px", 
                        borderRadius: "4px", 
                        background: "#e0e7ff", 
                        color: "#3730a3",
                        fontSize: "0.875rem"
                    }}>
                        {t.status}
                    </span>
                </td>
                <td style={{ padding: "10px" }}>
                  <button 
                    onClick={() => markComplete(t.id)}
                    style={{
                        padding: "6px 12px",
                        cursor: "pointer",
                        background: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: "4px"
                    }}
                  >
                    Mark Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}