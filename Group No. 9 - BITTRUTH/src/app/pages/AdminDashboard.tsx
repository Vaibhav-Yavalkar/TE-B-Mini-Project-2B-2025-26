import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Database, RefreshCw, Users, Shield, Activity } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

const PHP_API_BASE_URL = import.meta.env.VITE_PHP_API_URL ?? "http://127.0.0.1:8080";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  subscription: string;
  uploadCount: number;
  uploadLimit: number | null;
  uploadsRemaining: number | null;
  createdAt: string;
  activeSessions: number;
}

interface AdminResponse {
  users: AdminUser[];
  summary: {
    totalUsers: number;
    freeUsers: number;
    paidUsers: number;
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${PHP_API_BASE_URL}/admin/users`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to load admin data.");
      }
      const payload: AdminResponse = await response.json();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <div className="container mx-auto px-6 py-12">
        <div className="mb-10">
          <Link to="/">
            <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 mb-6 hover:bg-cyan-400/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <Database className="w-12 h-12 text-cyan-400" />
                <h1 className="text-5xl font-bold text-cyan-300">Admin Dashboard</h1>
              </div>
              <p className="text-gray-300 text-lg">
                View users, plans, upload usage, and active sessions from the browser.
              </p>
            </div>
            <Button
              onClick={() => void loadUsers()}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {loading && (
          <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl">
            <p className="text-cyan-300 text-lg">Loading admin data...</p>
          </Card>
        )}

        {error && !loading && (
          <Card className="bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/30 backdrop-blur-sm p-6 rounded-2xl mb-8">
            <p className="text-red-200 text-lg">{error}</p>
            <p className="text-red-100/80 text-sm mt-2">
              Make sure the PHP backend is running at <span className="font-semibold">{PHP_API_BASE_URL}</span>.
            </p>
          </Card>
        )}

        {data && !loading && (
          <>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-500/30 backdrop-blur-sm p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-6 h-6 text-cyan-300" />
                  <h2 className="text-xl font-semibold text-cyan-200">Total Users</h2>
                </div>
                <p className="text-4xl font-bold text-white">{data.summary.totalUsers}</p>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-500/30 backdrop-blur-sm p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-6 h-6 text-emerald-300" />
                  <h2 className="text-xl font-semibold text-emerald-200">Free Users</h2>
                </div>
                <p className="text-4xl font-bold text-white">{data.summary.freeUsers}</p>
              </Card>
              <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/30 backdrop-blur-sm p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-6 h-6 text-purple-300" />
                  <h2 className="text-xl font-semibold text-purple-200">Paid Users</h2>
                </div>
                <p className="text-4xl font-bold text-white">{data.summary.paidUsers}</p>
              </Card>
            </div>

            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-6 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-cyan-300">
                    <th className="py-3 pr-4">ID</th>
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Plan</th>
                    <th className="py-3 pr-4">Uploads</th>
                    <th className="py-3 pr-4">Remaining</th>
                    <th className="py-3 pr-4">Sessions</th>
                    <th className="py-3 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-800 text-gray-200">
                      <td className="py-3 pr-4">{user.id}</td>
                      <td className="py-3 pr-4">{user.name}</td>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4 capitalize">{user.subscription}</td>
                      <td className="py-3 pr-4">
                        {user.uploadCount}
                        {user.uploadLimit !== null ? ` / ${user.uploadLimit}` : " / Unlimited"}
                      </td>
                      <td className="py-3 pr-4">
                        {user.uploadsRemaining === null ? "Unlimited" : user.uploadsRemaining}
                      </td>
                      <td className="py-3 pr-4">{user.activeSessions}</td>
                      <td className="py-3 pr-4">{new Date(user.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
