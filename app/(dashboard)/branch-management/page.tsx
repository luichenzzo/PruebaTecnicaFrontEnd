"use client";

import { useEffect, useState } from "react";
import { User, Branch, RegisterRequest } from "@/types";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Plus, Users, Building, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function BranchManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"users" | "branches">("users");

  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useWebSocket("/topic/branches", () => {

    setTimeout(() => setRefresh(prev => prev + 1), 800);
  });

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Forms
  const [userForm, setUserForm] = useState<RegisterRequest>({
    username: "",
    fullName: "",
    email: "",
    password: "",
    role: "OPERATOR",
    branchId: ""
  });

  const [branchForm, setBranchForm] = useState({
    code: "",
    name: "",
    address: ""
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (user?.role === "ADMIN") {
        const [usersData, branchesData] = await Promise.all([
          apiClient<User[]>("/api/auth/users"),
          apiClient<Branch[]>("/api/branches")
        ]);
        setUsers(usersData);
        setBranches(branchesData);
      } else if (user?.role === "MANAGER") {
        const [usersData, branchesData] = await Promise.all([
          apiClient<User[]>("/api/auth/users"),
          apiClient<Branch[]>("/api/branches")
        ]);
        setUsers(usersData);
        setBranches(branchesData);
      }
    } catch (error) {
      toast({ type: "error", title: "Failed to load management data" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "MANAGER") {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, refresh, toast]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Ensure managers can only create users for their own branch
    const payload = {
      ...userForm,
      branchId: user?.role === "MANAGER" ? user.branchId : userForm.branchId
    };

    try {
      await apiClient("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      toast({ type: "success", title: "User created successfully" });
      setIsUserModalOpen(false);
      setUserForm({ username: "", fullName: "", email: "", password: "", role: "OPERATOR", branchId: "" });
      fetchData();
    } catch (error: any) {
      toast({ type: "error", title: "Failed to create user", message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "ADMIN") {
      toast({ type: "error", title: "Access Denied", message: "Only admins can create branches." });
      return;
    }
    
    setIsProcessing(true);
    try {
      await apiClient("/api/branches", {
        method: "POST",
        body: JSON.stringify(branchForm)
      });
      toast({ type: "success", title: "Branch created successfully" });
      setIsBranchModalOpen(false);
      setBranchForm({ code: "", name: "", address: "" });
      fetchData();
    } catch (error: any) {
      toast({ type: "error", title: "Failed to create branch", message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this branch? This action cannot be undone.")) return;
    try {
      await apiClient(`/api/branches/${id}`, { method: "DELETE" });
      toast({ type: "success", title: "Branch deleted successfully" });
      fetchData();
    } catch (error: any) {
      toast({ type: "error", title: "Failed to delete branch", message: error.message });
    }
  };

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return <div className="text-red-500">Access Denied.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage system users and physical branches.</p>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-4 px-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "users" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <Users size={16} />
          Users
        </button>
        {user?.role === "ADMIN" && (
          <button
            onClick={() => setActiveTab("branches")}
            className={`pb-4 px-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "branches" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Building size={16} />
            Branches
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading management data...</div>
        ) : activeTab === "users" ? (
          <div>
            <div className="p-4 border-b flex justify-end">
              <Button className="gap-2" onClick={() => setIsUserModalOpen(true)}>
                <Plus size={16} /> Create User
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-gray-900">{u.fullName}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell className="text-gray-500">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "success" : u.role === "MANAGER" ? "warning" : "default"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{u.branchId || "GLOBAL"}</TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">No users found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div>
            <div className="p-4 border-b flex justify-end">
              <Button className="gap-2" onClick={() => setIsBranchModalOpen(true)}>
                <Plus size={16} /> Create Branch
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Branch ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-gray-900">{b.name}</TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{b.code}</TableCell>
                    <TableCell>{b.address}</TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{b.id}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={() => handleDeleteBranch(b.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {branches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">No branches found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={isUserModalOpen} onClose={() => !isProcessing && setIsUserModalOpen(false)} title="Create New User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <Input required value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <Input required value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="johndoe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input required type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="john@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input required type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="******" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={userForm.role}
                onChange={e => setUserForm({...userForm, role: e.target.value as any})}
              >
                <option value="OPERATOR">Operator</option>
                {user?.role === "ADMIN" && <option value="MANAGER">Manager</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select 
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                value={user?.role === "MANAGER" ? (user.branchId || "") : userForm.branchId} 
                onChange={e => setUserForm({...userForm, branchId: e.target.value})} 
                disabled={user?.role === "MANAGER"}
                title={user?.role === "MANAGER" ? "Managers are locked to their own branch" : ""}
              >
                <option value="">Global (No Branch)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-4 gap-2 border-t">
            <Button type="button" variant="outline" onClick={() => setIsUserModalOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button type="submit" disabled={isProcessing}>Create User</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isBranchModalOpen} onClose={() => !isProcessing && setIsBranchModalOpen(false)} title="Create New Branch">
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
            <Input required value={branchForm.code} onChange={e => setBranchForm({...branchForm, code: e.target.value})} placeholder="BR-DT" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
            <Input required value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} placeholder="Downtown Store" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <Input required value={branchForm.address} onChange={e => setBranchForm({...branchForm, address: e.target.value})} placeholder="123 Main St" />
          </div>
          <div className="flex justify-end pt-4 gap-2 border-t">
            <Button type="button" variant="outline" onClick={() => setIsBranchModalOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button type="submit" disabled={isProcessing}>Create Branch</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
