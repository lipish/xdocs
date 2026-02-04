import { useState } from 'react';
import { useDocuments, Document, PermissionType } from '@/contexts/DocumentContext';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Upload,
  FileText,
  Trash2,
  Edit,
  Eye,
  Lock,
  Globe,
  Users,
  Search,
} from 'lucide-react';

export default function DocumentsPage() {
  const { accessibleDocuments, uploadDocument, updateDocument, deleteDocument, canEdit } = useDocuments();
  const { directoryUsers, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const filteredDocs = accessibleDocuments.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadDocument(file, uploadNotes);
      toast.success('文档上传成功');
      setUploadDialogOpen(false);
      setUploadNotes('');
    } catch (error) {
      toast.error((error as Error)?.message || '上传失败');
    }
    setIsUploading(false);
  };

  const handleUpdateDocument = async (updates: Partial<Document>) => {
    if (!editingDoc) return;
    const ok = await updateDocument(editingDoc.id, updates);
    if (ok) {
      toast.success('文档已更新');
      setEditingDoc(null);
    } else {
      toast.error('更新失败');
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    const ok = await deleteDocument(doc.id);
    if (ok) {
      toast.success('文档已删除');
    } else {
      toast.error('删除失败');
    }
  };

  const getPermissionIcon = (permission: PermissionType) => {
    switch (permission) {
      case 'public': return <Globe className="h-4 w-4 text-green-500" />;
      case 'private': return <Lock className="h-4 w-4 text-red-500" />;
      case 'specific': return <Users className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPermissionLabel = (permission: PermissionType) => {
    switch (permission) {
      case 'public': return '公开';
      case 'private': return '私有';
      case 'specific': return '指定用户';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">文档管理</h1>
            <p className="text-muted-foreground mt-1">上传、管理和分享您的文档</p>
          </div>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <Upload className="h-4 w-4 mr-2" />
                上传文档
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>上传新文档</DialogTitle>
                <DialogDescription>选择文件并添加备注</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">选择文件</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">备注（可选）</Label>
                  <Textarea
                    id="notes"
                    placeholder="描述这个文档是干什么的..."
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.length === 0 ? (
            <Card className="col-span-full border-border/50">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无文档</p>
              </CardContent>
            </Card>
          ) : (
            filteredDocs.map((doc) => (
              <Card key={doc.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-medium truncate">
                          {doc.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {doc.ownerName}
                        </p>
                      </div>
                    </div>
                    {getPermissionIcon(doc.permission)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {doc.notes || '暂无备注'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(doc.createdAt).toLocaleDateString('zh-CN')}</span>
                    {doc.isGenerated && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        AI 生成
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingDoc(doc)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      查看
                    </Button>
                    {canEdit(doc) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingDoc(doc)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteDocument(doc)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑文档</DialogTitle>
              <DialogDescription>修改文档备注和权限设置</DialogDescription>
            </DialogHeader>
            {editingDoc && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={editingDoc.notes}
                    onChange={(e) => setEditingDoc({ ...editingDoc, notes: e.target.value })}
                    placeholder="描述这个文档是干什么的..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>权限设置</Label>
                  <Select
                    value={editingDoc.permission}
                    onValueChange={(value: PermissionType) => 
                      setEditingDoc({ ...editingDoc, permission: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-green-500" />
                          公开 - 所有人可见
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-red-500" />
                          私有 - 仅自己可见
                        </div>
                      </SelectItem>
                      <SelectItem value="specific">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          指定用户
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingDoc.permission === 'specific' && (
                  <div className="space-y-2">
                    <Label>选择可访问的用户</Label>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {directoryUsers.filter(u => u.id !== user?.id).map((u) => (
                        <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingDoc.allowedUsers.includes(u.id)}
                            onChange={(e) => {
                              const newAllowed = e.target.checked
                                ? [...editingDoc.allowedUsers, u.id]
                                : editingDoc.allowedUsers.filter(id => id !== u.id);
                              setEditingDoc({ ...editingDoc, allowedUsers: newAllowed });
                            }}
                            className="rounded border-input"
                          />
                          <span className="text-sm">{u.username}</span>
                          <span className="text-xs text-muted-foreground">({u.email})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDoc(null)}>
                取消
              </Button>
              <Button
                className="gradient-primary text-white"
                onClick={() => handleUpdateDocument({
                  notes: editingDoc?.notes,
                  permission: editingDoc?.permission,
                  allowedUsers: editingDoc?.allowedUsers,
                })}
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {viewingDoc?.name}
              </DialogTitle>
              <DialogDescription>
                上传者: {viewingDoc?.ownerName} · {viewingDoc && new Date(viewingDoc.createdAt).toLocaleString('zh-CN')}
              </DialogDescription>
            </DialogHeader>
            {viewingDoc && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  {getPermissionIcon(viewingDoc.permission)}
                  <span>{getPermissionLabel(viewingDoc.permission)}</span>
                  {viewingDoc.isGenerated && (
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent ml-2">
                      AI 生成
                    </span>
                  )}
                </div>
                {viewingDoc.notes && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">备注</p>
                    <p className="text-sm text-muted-foreground">{viewingDoc.notes}</p>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  文件大小: {(viewingDoc.size / 1024).toFixed(2)} KB
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
