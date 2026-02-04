import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">您没有权限访问此页面</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">设置</h1>
          <p className="text-muted-foreground mt-1">管理平台配置</p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">平台信息</CardTitle>
            <CardDescription>Xinference 文档管理平台</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">版本</p>
                <p className="text-lg font-medium">1.0.0</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">存储模式</p>
                <p className="text-lg font-medium">本地存储 (localStorage)</p>
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">说明</p>
              <p className="text-sm">
                当前版本使用浏览器本地存储保存数据。数据仅保存在当前浏览器中，
                清除浏览器数据会导致数据丢失。如需持久化存储，请联系管理员配置后端数据库。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
