import { useState } from 'react';
import { useDocuments } from '@/contexts/DocumentContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Sparkles, FileText, Loader2, Save, Copy } from 'lucide-react';

export default function GeneratePage() {
  const { accessibleDocuments, saveGeneratedDocument } = useDocuments();
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [docName, setDocName] = useState('');

  const toggleDocument = (docId: string) => {
    setSelectedDocs(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleGenerate = async () => {
    if (selectedDocs.length === 0) {
      toast.error('请至少选择一个文档');
      return;
    }
    if (!prompt.trim()) {
      toast.error('请输入生成要求');
      return;
    }

    setIsGenerating(true);
    
    // Simulate AI generation (in real app, this would call an API)
    setTimeout(() => {
      const selectedDocNames = accessibleDocuments
        .filter(d => selectedDocs.includes(d.id))
        .map(d => d.name);
      
      const mockContent = `# 基于文档生成的内容

## 参考文档
${selectedDocNames.map(n => `- ${n}`).join('\n')}

## 用户需求
${prompt}

## 生成内容

这是一个模拟的AI生成结果。在实际应用中，这里会调用大语言模型（如 Xinference 部署的模型）来根据所选文档的内容和用户的需求生成相应的文档。

### 主要内容

根据您选择的 ${selectedDocNames.length} 个文档，结合您的需求 "${prompt}"，生成了以下内容：

1. **内容摘要**：这是对所选文档的综合分析和总结。
2. **关键要点**：提取了文档中的核心信息。
3. **扩展建议**：基于文档内容的进一步建议。

### 结论

以上内容是基于您提供的文档和需求自动生成的。如需进一步调整，请修改需求后重新生成。

---
*此文档由 Xinference 文档管理平台 AI 生成*
*生成时间：${new Date().toLocaleString('zh-CN')}*`;

      setGeneratedContent(mockContent);
      setIsGenerating(false);
      toast.success('内容生成完成');
    }, 2000);
  };

  const handleSave = () => {
    if (!docName.trim()) {
      toast.error('请输入文档名称');
      return;
    }
    if (!generatedContent) {
      toast.error('没有可保存的内容');
      return;
    }

    try {
      saveGeneratedDocument(docName, generatedContent, `基于 ${selectedDocs.length} 个文档生成`);
      toast.success('文档已保存');
      setGeneratedContent('');
      setDocName('');
      setSelectedDocs([]);
      setPrompt('');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success('已复制到剪贴板');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI 内容生成
          </h1>
          <p className="text-muted-foreground mt-1">
            选择文档，输入需求，通过 AI 生成新的内容
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Input */}
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">选择参考文档</CardTitle>
                <CardDescription>选择要作为参考的文档</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {accessibleDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无可用文档
                    </p>
                  ) : (
                    accessibleDocuments.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedDocs.includes(doc.id)}
                          onCheckedChange={() => toggleDocument(doc.id)}
                        />
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {doc.notes || '暂无备注'}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  已选择 {selectedDocs.length} 个文档
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">生成需求</CardTitle>
                <CardDescription>描述您想要生成的内容</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="例如：请根据这些文档生成一份项目总结报告，包含主要功能、技术架构和使用说明..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                />
                <Button
                  className="w-full gradient-primary text-white"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      生成内容
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Output */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                生成结果
                {generatedContent && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedContent ? (
                <>
                  <div className="bg-muted rounded-lg p-4 max-h-80 overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {generatedContent}
                    </pre>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="docName" className="sr-only">文档名称</Label>
                      <Input
                        id="docName"
                        placeholder="输入文档名称以保存..."
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                      />
                    </div>
                    <Button
                      className="gradient-primary text-white"
                      onClick={handleSave}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      保存文档
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    选择文档并输入需求后，<br />
                    点击"生成内容"按钮开始
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
