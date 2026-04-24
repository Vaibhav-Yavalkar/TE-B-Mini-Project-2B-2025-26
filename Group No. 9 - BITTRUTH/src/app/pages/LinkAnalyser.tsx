import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  ScrollText,
  ScanText,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

interface TextResult {
  kind: 'text';
  source: string;
  verdict: 'plagiarized' | 'original';
  confidenceScore: number;
  plagiarismScore: number;
  originalityScore: number;
  predictedIndex: number;
  logs: string[];
}

interface ImageResult {
  kind: 'image';
  source: string;
  verdict: 'fake' | 'real';
  confidenceScore: number;
  fakeScore: number;
  realScore: number;
  predictedIndex: number;
  logs: string[];
}

type AnalysisResult = TextResult | ImageResult;

interface TextApiResponse {
  type: 'text';
  model: string;
  label: 'plagiarized' | 'original';
  plagiarism_score: number;
  originality_score: number;
  confidence_score: number;
  predicted_index: number;
  raw_logits: number[];
  logs: string[];
  source: string;
}

interface ImageApiResponse {
  type: 'image';
  model: string;
  label: 'real' | 'fake';
  fake_score: number;
  real_score: number;
  confidence_score: number;
  predicted_index: number;
  raw_logits: number[];
  logs: string[];
  source: string;
}

export default function LinkAnalyser() {
  const { consumeUpload } = useAuth();
  const [activeTab, setActiveTab] = useState<'text' | 'url' | 'file' | 'image-upload' | 'image-url'>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedTextFile, setSelectedTextFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisStage, setAnalysisStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const runTextAnalysis = async () => {
    let response: Response;
    if (activeTab === 'text') {
      response = await fetch(`${API_BASE_URL}/analyze/plagiarism-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput }),
      });
    } else if (activeTab === 'url') {
      response = await fetch(`${API_BASE_URL}/analyze/plagiarism-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });
    } else {
      const uploadCheck = await consumeUpload();
      if (!uploadCheck.allowed) {
        throw new Error(uploadCheck.message || 'Upload not allowed.');
      }
      const formData = new FormData();
      formData.append('file', selectedTextFile!);
      response = await fetch(`${API_BASE_URL}/analyze/plagiarism-file`, {
        method: 'POST',
        body: formData,
      });
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.detail || 'Text plagiarism analysis failed.');
    }

    const apiResult: TextApiResponse = await response.json();
    return {
      kind: 'text' as const,
      source: apiResult.source,
      verdict: apiResult.label,
      confidenceScore: Math.round(apiResult.confidence_score),
      plagiarismScore: Math.round(apiResult.plagiarism_score),
      originalityScore: Math.round(apiResult.originality_score),
      predictedIndex: apiResult.predicted_index,
      logs: apiResult.logs,
    };
  };

  const runImageAnalysis = async () => {
    let response: Response;
    if (activeTab === 'image-upload') {
      const uploadCheck = await consumeUpload();
      if (!uploadCheck.allowed) {
        throw new Error(uploadCheck.message || 'Upload not allowed.');
      }
      const formData = new FormData();
      formData.append('file', selectedImageFile!);
      response = await fetch(`${API_BASE_URL}/analyze/image`, {
        method: 'POST',
        body: formData,
      });
    } else {
      response = await fetch(`${API_BASE_URL}/analyze/image-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new Error(errorPayload?.detail || 'Image authenticity analysis failed.');
    }

    const apiResult: ImageApiResponse = await response.json();
    return {
      kind: 'image' as const,
      source: apiResult.source,
      verdict: apiResult.label,
      confidenceScore: Math.round(apiResult.confidence_score),
      fakeScore: Math.round(apiResult.fake_score),
      realScore: Math.round(apiResult.real_score),
      predictedIndex: apiResult.predicted_index,
      logs: apiResult.logs,
    };
  };

  const analyze = async () => {
    const invalid =
      (activeTab === 'text' && !textInput.trim()) ||
      (activeTab === 'url' && !urlInput.trim()) ||
      (activeTab === 'file' && !selectedTextFile) ||
      (activeTab === 'image-upload' && !selectedImageFile) ||
      (activeTab === 'image-url' && !imageUrl.trim());

    if (invalid) return;

    setLoading(true);
    setResult(null);
    setError(null);

    const stages =
      activeTab === 'image-upload' || activeTab === 'image-url'
        ? [
            'Loading image...',
            'Running modification detector...',
            'Scoring real vs manipulated image...',
            'Collecting model logs...',
          ]
        : [
            'Tokenizing text with DistilBERT...',
            'Running plagiarism classifier...',
            'Scoring original vs plagiarized text...',
            'Collecting model logs...',
          ];

    let currentStage = 0;
    const stageInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setAnalysisStage(stages[currentStage]);
        currentStage++;
      }
    }, 700);

    try {
      const nextResult =
        activeTab === 'image-upload' || activeTab === 'image-url'
          ? await runImageAnalysis()
          : await runTextAnalysis();
      clearInterval(stageInterval);
      setResult(nextResult);
    } catch (err) {
      clearInterval(stageInterval);
      setError(err instanceof Error ? err.message : 'Unable to analyze input.');
    } finally {
      setLoading(false);
      setAnalysisStage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <div className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <Link to="/">
            <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 mb-6 hover:bg-cyan-400/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <ScrollText className="w-12 h-12 text-cyan-400" />
            <h1 className="text-5xl font-bold text-cyan-300">Plagiarism Detector</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Detect plagiarized text.
          </p>
        </div>

        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl mb-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-900/50 mb-6">
              <TabsTrigger value="text" className="data-[state=active]:bg-cyan-600">Text</TabsTrigger>
              <TabsTrigger value="file" className="data-[state=active]:bg-cyan-600">Text File</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <Textarea
                placeholder="Paste text here to check whether it is original or plagiarized..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[260px] bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-400 text-lg p-4"
              />
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <Input
                type="text"
                placeholder="Enter a webpage URL to fetch and analyze its text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyze()}
                className="bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-400 text-lg py-6"
              />
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-400">
                    <span className="font-semibold">Click to upload</span> a text or PDF file
                  </p>
                  <p className="text-xs text-gray-500">TXT, MD, PDF</p>
                  {selectedTextFile && <p className="mt-2 text-sm text-cyan-400 font-semibold">{selectedTextFile.name}</p>}
                </div>
                <input type="file" className="hidden" accept=".txt,.md,.pdf,text/plain,application/pdf" onChange={(e) => setSelectedTextFile(e.target.files?.[0] ?? null)} />
              </label>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={analyze}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-6 text-lg"
            >
              {loading ? (
                <>Analyzing...</>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </Card>

        {loading && (
          <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400 mb-4"></div>
              <p className="text-cyan-300 text-xl mb-4">Analyzing content...</p>
              {analysisStage && <p className="text-cyan-400 text-lg animate-pulse">{analysisStage}</p>}
            </div>
          </Card>
        )}

        {error && !loading && (
          <Card className="bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/30 backdrop-blur-sm p-6 rounded-2xl mb-8">
            <p className="text-red-200 text-lg">{error}</p>
            <p className="text-red-100/80 text-sm mt-2">Make sure the backend is running at <span className="font-semibold">{API_BASE_URL}</span>.</p>
          </Card>
        )}

        {result && !loading && (
          <div className="space-y-6">
            <Card className={`border-2 backdrop-blur-sm p-8 rounded-2xl ${
              (result.kind === 'text' && result.verdict === 'original') || (result.kind === 'image' && result.verdict === 'real')
                ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/50'
                : 'bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/50'
            }`}>
              <div className="flex items-center gap-4 mb-4">
                {(result.kind === 'text' && result.verdict === 'original') || (result.kind === 'image' && result.verdict === 'real') ? (
                  <CheckCircle2 className="w-16 h-16 text-green-400" />
                ) : (
                  <XCircle className="w-16 h-16 text-red-400" />
                )}
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {result.kind === 'text'
                      ? result.verdict === 'original' ? 'Text is Original' : 'Plagiarism Detected'
                      : result.verdict === 'real' ? 'Image is Authentic' : 'Image is Modified / Fake'}
                  </h2>
                  <p className="text-gray-300">
                    Confidence: <span className="font-bold text-2xl">{result.confidenceScore}%</span>
                  </p>
                </div>
              </div>
              <p className="text-gray-200 break-all"><strong>Analyzed Source:</strong> {result.source}</p>
              <p className="text-gray-200 mt-2"><strong>Predicted Class Index:</strong> {result.predictedIndex}</p>
            </Card>

            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-cyan-300 mb-6 flex items-center gap-2">
                {result.kind === 'text' ? <ScanText className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                Score Breakdown
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-300 mb-2">
                    {result.kind === 'text' ? 'Plagiarism Score' : 'Modified / Fake Score'}
                  </p>
                  <Progress value={result.kind === 'text' ? result.plagiarismScore : result.fakeScore} className="h-4 mb-2" />
                  <p className="text-2xl font-bold text-red-400">
                    {result.kind === 'text' ? result.plagiarismScore : result.fakeScore}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-300 mb-2">
                    {result.kind === 'text' ? 'Originality Score' : 'Authenticity Score'}
                  </p>
                  <Progress value={result.kind === 'text' ? result.originalityScore : result.realScore} className="h-4 mb-2" />
                  <p className="text-2xl font-bold text-green-400">
                    {result.kind === 'text' ? result.originalityScore : result.realScore}%
                  </p>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-slate-900/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-cyan-300 mb-6 flex items-center gap-2">
                <ShieldAlert className="w-6 h-6" />
                Model Logs
              </h3>
              <ul className="space-y-3">
                {result.logs.map((line, index) => (
                  <li key={index} className="text-gray-200 break-words">{line}</li>
                ))}
              </ul>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border-indigo-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-indigo-300 mb-4">Recommendation</h3>
              <p className="text-gray-200 text-lg">
                {result.kind === 'text'
                  ? result.verdict === 'original'
                    ? 'The text classifier marked this content as original. Review the logs and confidence before using the result as a final academic decision.'
                    : 'The text classifier marked this content as plagiarized. Review the logs and compare with source material before taking action.'
                  : result.verdict === 'real'
                    ? 'The image model marked this photo as authentic. Review the confidence and logs before trusting high-stakes visual evidence.'
                    : 'The image model marked this photo as modified or fake. Review the confidence and logs before making a moderation or trust decision.'}
              </p>
            </Card>
          </div>
        )}
      </div>

      <footer className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 py-6 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-300 text-lg">
            Team: <span className="text-cyan-400 font-semibold">CODE CLUCTURES</span>
          </p>
        </div>
      </footer>
    </div>
  ); 
}
