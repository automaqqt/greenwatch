'use client'
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Pencil, Trash2 } from 'lucide-react';

interface User {
  id: number;
  username: string;
  password: string;
  api_key: string;
  germination_date: string | null;
}

interface AdminPanelProps {
  auth: {
    isAuthenticated: boolean;
    username: string;
    password: string;
  };
  API_BASE: string;
  API_KEY: string;
}

const AdminPanel = ({ auth, API_BASE, API_KEY }: AdminPanelProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    api_key: '',
  });
  const [editUser, setEditUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const url = new URL(`${API_BASE}/admin/users`);
      url.searchParams.append('key', API_KEY);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      setError('Username and password are required');
      return;
    }

    try {
      const url = new URL(`${API_BASE}/admin/users`);
      url.searchParams.append('key', API_KEY);
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          api_key: newUser.api_key || generateApiKey(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create user');
      }
      
      // Reset form
      setNewUser({
        username: '',
        password: '',
        api_key: '',
      });
      
      // Refresh user list
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to create user. Please try again.');
    }
  };

  const handleUpdateUser = async () => {
    if (!editUser || !editUser.username || !editUser.password) {
      setError('Username and password are required');
      return;
    }

    try {
      const url = new URL(`${API_BASE}/admin/users/${editUser.id}`);
      url.searchParams.append('key', API_KEY);
      
      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: editUser.username,
          password: editUser.password,
          api_key: editUser.api_key,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user');
      }
      
      // Reset edit user
      setEditUser(null);
      
      // Refresh user list
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const url = new URL(`${API_BASE}/admin/users/${userId}`);
      url.searchParams.append('key', API_KEY);
      
      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      // Refresh user list
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user. Please try again.');
    }
  };

  const generateApiKey = () => {
    // Generate a random API key (16 chars)
    return Math.random().toString(36).substring(2, 10) + 
           Math.random().toString(36).substring(2, 10);
  };

  // Only show admin panel if the current user is "admin"
  if (auth.username !== 'admin') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <p>You need administrator privileges to access this panel.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">User Management</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">Users</h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input 
                    placeholder="Username" 
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key (Optional)</label>
                  <div className="flex space-x-2">
                    <Input 
                      placeholder="Leave blank to generate automatically" 
                      value={newUser.api_key}
                      onChange={(e) => setNewUser({...newUser, api_key: e.target.value})}
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => setNewUser({...newUser, api_key: generateApiKey()})}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleCreateUser}>Create User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading users...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-gray-100 p-1 rounded">
                          {user.api_key}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setEditUser(user)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                              </DialogHeader>
                              {editUser && (
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Username</label>
                                    <Input 
                                      value={editUser.username}
                                      onChange={(e) => setEditUser({
                                        ...editUser, 
                                        username: e.target.value
                                      })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Password</label>
                                    <Input 
                                      type="password" 
                                      placeholder="Enter new password" 
                                      value={editUser.password}
                                      onChange={(e) => setEditUser({
                                        ...editUser, 
                                        password: e.target.value
                                      })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">API Key</label>
                                    <div className="flex space-x-2">
                                      <Input 
                                        value={editUser.api_key}
                                        onChange={(e) => setEditUser({
                                          ...editUser, 
                                          api_key: e.target.value
                                        })}
                                      />
                                      <Button 
                                        variant="outline" 
                                        onClick={() => setEditUser({
                                          ...editUser, 
                                          api_key: generateApiKey()
                                        })}
                                      >
                                        Regenerate
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button onClick={handleUpdateUser}>Save Changes</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {user.username}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;