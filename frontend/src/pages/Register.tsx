import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiFetch<void>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          note: note.trim() ? note : undefined,
        }),
      });

      toast.success('注册成功，请等待管理员审核');
      navigate('/login');
    } catch (err) {
      toast.error((err as Error)?.message || '注册失败');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-background/95 border border-border/60 shadow-sm flex items-center justify-center mx-auto mb-4">
            <img src="/favicon.svg" alt="Logo" className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Xinference</h1>
          <p className="text-muted-foreground mt-2">文档管理平台</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>注册账号</CardTitle>
            <CardDescription>注册后需要管理员审核通过才能登录</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  placeholder="输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">备注（可选）</Label>
                <Textarea
                  id="note"
                  placeholder="例如：用途、团队、备注信息"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full gradient-primary text-white hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? '提交中...' : '提交注册'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/login')}
                  disabled={isLoading}
                >
                  返回登录
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
