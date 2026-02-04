import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

type DownloadRequest = {
  id: string;
  documentId: string;
  requesterId: string;
  requesterName: string;
  documentName: string;
  ownerId: string;
  ownerName: string;
  applicantName: string;
  applicantCompany: string;
  applicantContact: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  approverId?: string;
  approverName?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
};

function statusLabel(status: string) {
  if (status === 'pending') return '待审批';
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已拒绝';
  return status;
}

export default function DownloadRequestsPage() {
  const [mine, setMine] = useState<DownloadRequest[]>([]);
  const [pending, setPending] = useState<DownloadRequest[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshMine = async () => {
    setLoadingMine(true);
    try {
      const list = await apiFetch<DownloadRequest[]>('/download-requests/mine');
      setMine(list);
    } catch (err) {
      toast.error((err as Error)?.message || '加载失败');
      setMine([]);
    }
    setLoadingMine(false);
  };

  const refreshPending = async () => {
    setLoadingPending(true);
    try {
      const list = await apiFetch<DownloadRequest[]>('/download-requests/pending');
      setPending(list);
    } catch {
      setPending([]);
    }
    setLoadingPending(false);
  };

  useEffect(() => {
    refreshMine();
    refreshPending();
  }, []);

  const approve = async (id: string) => {
    setSubmitting(true);
    try {
      await apiFetch<void>(`/download-requests/${id}/approve`, { method: 'POST' });
      toast.success('已通过');
      await refreshPending();
    } catch (err) {
      toast.error((err as Error)?.message || '操作失败');
    }
    setSubmitting(false);
  };

  const reject = async (id: string) => {
    setSubmitting(true);
    try {
      await apiFetch<void>(`/download-requests/${id}/reject`, { method: 'POST' });
      toast.success('已拒绝');
      await refreshPending();
    } catch (err) {
      toast.error((err as Error)?.message || '操作失败');
    }
    setSubmitting(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">下载申请</h1>
          <p className="text-muted-foreground mt-1">提交下载申请并处理待审批请求</p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">我的申请</CardTitle>
            <CardDescription>{loadingMine ? '加载中...' : `共 ${mine.length} 条`}</CardDescription>
          </CardHeader>
          <CardContent>
            {mine.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无申请</div>
            ) : (
              <div className="space-y-3">
                {mine.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium truncate">{r.documentName}</div>
                      <div className="text-xs text-muted-foreground">{statusLabel(r.status)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">所有者：{r.ownerName}</div>
                    {r.expiresAt ? (
                      <div className="text-xs text-muted-foreground">有效期至：{new Date(r.expiresAt).toLocaleString('zh-CN')}</div>
                    ) : null}
                    {r.message ? (
                      <div className="text-xs text-muted-foreground">备注：{r.message}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">待我审批</CardTitle>
            <CardDescription>{loadingPending ? '加载中...' : `共 ${pending.length} 条待审批`}</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无待审批请求</div>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium truncate">{r.documentName}</div>
                      <div className="text-xs text-muted-foreground">申请人：{r.requesterName}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      姓名：{r.applicantName} · 公司：{r.applicantCompany} · 联系方式：{r.applicantContact}
                    </div>
                    {r.message ? (
                      <div className="text-xs text-muted-foreground">备注：{r.message}</div>
                    ) : null}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gradient-primary text-white"
                        disabled={submitting}
                        onClick={() => approve(r.id)}
                      >
                        通过
                      </Button>
                      <Button size="sm" variant="outline" disabled={submitting} onClick={() => reject(r.id)}>
                        拒绝
                      </Button>
                    </div>
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
