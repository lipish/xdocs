import { useAuth } from '@/contexts/AuthContext';
import { useDocuments } from '@/contexts/DocumentContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Sparkles, FolderOpen } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function DashboardPage() {
  const { user, users, isAdmin } = useAuth();
  const { documents, myDocuments, accessibleDocuments } = useDocuments();

  const stats = [
    {
      title: '我的文档',
      value: myDocuments.length,
      icon: FolderOpen,
      description: '您上传的文档',
    },
    {
      title: '可访问文档',
      value: accessibleDocuments.length,
      icon: FileText,
      description: '所有可查看的文档',
    },
    {
      title: 'AI 生成文档',
      value: documents.filter(d => d.isGenerated).length,
      icon: Sparkles,
      description: '通过 AI 生成的文档',
    },
    ...(isAdmin ? [{
      title: '用户数量',
      value: users.length,
      icon: Users,
      description: '平台注册用户',
    }] : []),
  ];

  const recentDocs = accessibleDocuments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">
            欢迎回来，<span className="gradient-text">{user?.username}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            这是您的文档管理仪表盘
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">最近文档</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                暂无文档，去上传一些吧！
              </p>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.ownerName} · {new Date(doc.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    {doc.isGenerated && (
                      <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent">
                        AI 生成
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
