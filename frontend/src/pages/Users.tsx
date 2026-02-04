import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Trash2, Shield, User } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type PendingUser = {
  id: string;
  username: string;
  note: string;
  createdAt: string;
};

export default function UsersPage() {
  const { users, createUser, deleteUser, isAdmin, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  });

  const refreshPendingUsers = async () => {
    setIsPendingLoading(true);
    try {
      const list = await apiFetch<PendingUser[]>('/users/pending');
      setPendingUsers(list);
    } catch {
      setPendingUsers([]);
    }
    setIsPendingLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    refreshPendingUsers();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">您没有权限访问此页面</p>
        </div>
      </AppLayout>
    );
  }

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error('请填写所有必填字段');
      return;
    }

    setIsSubmitting(true);
    const ok = await createUser(newUser.username, newUser.email, newUser.password, newUser.role);
    if (ok) {
      toast.success('用户创建成功');
      setDialogOpen(false);
      setNewUser({ username: '', email: '', password: '', role: 'user' });
    } else {
      toast.error('创建失败');
    }
    setIsSubmitting(false);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    setIsSubmitting(true);
    const ok = await deleteUser(userId);
    if (ok) {
      toast.success(`用户 ${username} 已删除`);
    } else {
      toast.error('无法删除此用户');
    }
    setIsSubmitting(false);
  };

  const handleApprove = async (id: string) => {
    setIsSubmitting(true);
    try {
      await apiFetch<void>(`/users/${id}/approve`, { method: 'POST' });
      toast.success('已通过');
      await refreshPendingUsers();
    } catch (err) {
      toast.error((err as Error)?.message || '操作失败');
    }
    setIsSubmitting(false);
  };

  const handleDisable = async (id: string) => {
    setIsSubmitting(true);
    try {
      await apiFetch<void>(`/users/${id}/disable`, { method: 'POST' });
      toast.success('已禁用');
      await refreshPendingUsers();
    } catch (err) {
      toast.error((err as Error)?.message || '操作失败');
    }
    setIsSubmitting(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">用户管理</h1>
            <p className="text-muted-foreground mt-1">管理平台用户账户</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                添加用户
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加新用户</DialogTitle>
                <DialogDescription>创建一个新的平台用户账户</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    placeholder="输入用户名"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="输入密码"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">角色</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: 'admin' | 'user') =>
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          普通用户
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          管理员
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  className="gradient-primary text-white"
                  onClick={handleCreateUser}
                  disabled={isSubmitting}
                >
                  创建用户
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">待审核用户</CardTitle>
            <CardDescription>
              {isPendingLoading ? '加载中...' : `共 ${pendingUsers.length} 个待审核`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无待审核用户</div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <div className="font-medium">{u.username}</div>
                      {u.note ? (
                        <div className="text-xs text-muted-foreground mt-1">备注：{u.note}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gradient-primary text-white"
                        disabled={isSubmitting}
                        onClick={() => handleApprove(u.id)}
                      >
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => handleDisable(u.id)}
                      >
                        禁用
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">所有用户</CardTitle>
            <CardDescription>共 {users.length} 个用户</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-medium">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{u.username}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      u.role === 'admin'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {u.role === 'admin' ? '管理员' : '用户'}
                    </span>
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={isSubmitting}
                        onClick={() => handleDeleteUser(u.id, u.username)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
