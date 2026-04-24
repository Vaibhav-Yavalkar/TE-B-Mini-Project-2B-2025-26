import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Mic, Upload, Link as LinkIcon, Search, CheckCircle2, XCircle, AlertTriangle, Waves, Activity, FileAudio } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';

interface AudioAnalysisResult {
  source: string;
  isReal: boolean;
  verdict: 'real' | 'fake';
  confidenceScore: number;
  realScore: number;
  fakeScore: number;
  predictedIndex: number;
  durationSeconds: number;
  logs: string[];
}

interface AudioApiResponse {
  type: 'audio';
  model: string;
  label: 'real' | 'fake';
  fake_score: number;
  real_score: number;
  confidence_score: number;
  predicted_index: number;
  raw_logits: number[];
  logs: string[];
  duration_seconds: number;
  source: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export default function PlagiarismChecker() {
  const { consumeUpload } = useAuth();
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AudioAnalysisResult | null>(null);
  const [analysisStage, setAnalysisStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyzeAudio = async () => {
    if ((activeTab === 'url' && !urlInput) || (activeTab === 'file' && !selectedFile)) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const stages = [
      'Loading audio stream...',
      'Converting waveform into mel-spectrogram...',
      'Running EfficientNet audio detector...',
      'Scoring real vs fake speech patterns...',
      'Generating confidence logs...',
    ];

    let currentStage = 0;
    const stageInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setAnalysisStage(stages[currentStage]);
        currentStage++;
      }
    }, 700);

    try {
      let response: Response;
      let source = urlInput;

      if (activeTab === 'file' && selectedFile) {
        const uploadCheck = await consumeUpload();
        if (!uploadCheck.allowed) {
          throw new Error(uploadCheck.message || 'Upload not allowed.');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        source = selectedFile.name;
        response = await fetch(`${API_BASE_URL}/analyze/audio`, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`${API_BASE_URL}/analyze/audio-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: urlInput }),
        });
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail || 'Audio analysis failed.');
      }

      const apiResult: AudioApiResponse = await response.json();
      clearInterval(stageInterval);
      setResult({
        source,
        isReal: apiResult.label === 'real',
        verdict: apiResult.label,
        confidenceScore: Math.round(apiResult.confidence_score),
        realScore: Math.round(apiResult.real_score),
        fakeScore: Math.round(apiResult.fake_score),
        predictedIndex: apiResult.predicted_index,
        durationSeconds: apiResult.duration_seconds,
        logs: apiResult.logs,
      });
    } catch (err) {
      clearInterval(stageInterval);
      setError(err instanceof Error ? err.message : 'Unable to analyze audio.');
    } finally {
      setLoading(false);
      setAnalysisStage('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <div className="container mx-auto px-6 py-12">
        <div className="mb-12">
          <Link to="/">
            <Button variant="ghost" className="text-orange-400 hover:text-orange-300 mb-6 hover:bg-orange-400/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <Mic className="w-12 h-12 text-orange-400" />
            <h1 className="text-5xl font-bold text-orange-300">Audio Deepfake Detector</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Detect fake or cloned voices.
          </p>
        </div>

        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-orange-500/30 backdrop-blur-sm p-8 rounded-2xl mb-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'url' | 'file')}>

            <TabsContent value="file" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">WAV, MP3, M4A, FLAC, OGG, AAC</p>
                      {selectedFile && (
                        <p className="mt-2 text-sm text-orange-400 font-semibold">
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                <Button
                  onClick={analyzeAudio}
                  disabled={loading || !selectedFile}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-6 text-lg w-full sm:w-auto"
                >
                  {loading ? 'Analyzing...' : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Analyze Audio
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  type="text"
                  placeholder="Enter audio URL (e.g., https://example.com/sample.wav)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyzeAudio()}
                  className="flex-1 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-orange-400 text-lg py-6"
                />
                <Button
                  onClick={analyzeAudio}
                  disabled={loading || !urlInput}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-6 text-lg"
                >
                  {loading ? 'Analyzing...' : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Analyze URL
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {loading && (
          <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-orange-500/30 backdrop-blur-sm p-8 rounded-2xl">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-400 mb-4"></div>
              <p className="text-orange-300 text-xl mb-6">Analyzing audio for voice manipulation...</p>
              {analysisStage && (
                <p className="text-cyan-400 text-lg animate-pulse">{analysisStage}</p>
              )}
              <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 text-gray-300">
                  <Waves className="w-5 h-5 text-orange-400" />
                  <span>Waveform load</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Activity className="w-5 h-5 text-orange-400" />
                  <span>Spectrogram build</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Mic className="w-5 h-5 text-orange-400" />
                  <span>Voice analysis</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <FileAudio className="w-5 h-5 text-orange-400" />
                  <span>Confidence scoring</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {error && !loading && (
          <Card className="bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/30 backdrop-blur-sm p-6 rounded-2xl mb-8">
            <p className="text-red-200 text-lg">{error}</p>
            <p className="text-red-100/80 text-sm mt-2">
              Make sure the backend is running at <span className="font-semibold">{API_BASE_URL}</span>.
            </p>
          </Card>
        )}

        {result && !loading && (
          <div className="space-y-6">
            <Card className={`border-2 backdrop-blur-sm p-8 rounded-2xl ${
              result.isReal
                ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/50'
                : 'bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/50'
            }`}>
              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    {result.isReal ? (
                      <CheckCircle2 className="w-16 h-16 text-green-400" />
                    ) : (
                      <XCircle className="w-16 h-16 text-red-400" />
                    )}
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">
                        {result.isReal ? 'Audio is Real' : 'Audio is Fake'}
                      </h2>
                      <p className="text-gray-300">
                        Confidence: <span className="font-bold text-2xl">{result.confidenceScore}%</span>
                      </p>
                    </div>
                  </div>
                  <Progress value={result.realScore} className="h-4 mb-2" />
                  <p className="text-sm text-gray-400">Real Probability</p>
                </div>

                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <AlertTriangle className="w-16 h-16 text-orange-400" />
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">Fake Probability</h3>
                      <p className="text-gray-300">
                        Score: <span className="font-bold text-2xl">{result.fakeScore}%</span>
                      </p>
                    </div>
                  </div>
                  <Progress value={result.fakeScore} className="h-4 mb-2" />
                  <p className="text-sm text-gray-400">Synthetic Voice Likelihood</p>
                </div>
              </div>
              <p className="text-gray-200 break-all">
                <strong>Analyzed Source:</strong> {result.source}
              </p>
              <p className="text-gray-200 mt-2">
                <strong>Backend Verdict:</strong> {result.verdict.toUpperCase()} | <strong>Predicted Class Index:</strong> {result.predictedIndex} | <strong>Duration:</strong> {result.durationSeconds}s
              </p>
            </Card>

            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-orange-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-orange-300 mb-6 flex items-center gap-2">
                <Mic className="w-6 h-6" />
                Audio Statistics
              </h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-gray-900/50 p-6 rounded-lg text-center">
                  <p className="text-gray-400 mb-2">Duration</p>
                  <p className="text-3xl font-bold text-white">{result.durationSeconds}s</p>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg text-center">
                  <p className="text-gray-400 mb-2">Predicted Label</p>
                  <p className={`text-3xl font-bold ${result.isReal ? 'text-green-400' : 'text-red-400'}`}>{result.verdict.toUpperCase()}</p>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg text-center">
                  <p className="text-gray-400 mb-2">Real Score</p>
                  <p className="text-3xl font-bold text-green-400">{result.realScore}%</p>
                </div>
                <div className="bg-gray-900/50 p-6 rounded-lg text-center">
                  <p className="text-gray-400 mb-2">Fake Score</p>
                  <p className="text-3xl font-bold text-red-400">{result.fakeScore}%</p>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-slate-900/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-cyan-300 mb-6">Model Logs</h3>
              <ul className="space-y-3">
                {result.logs.map((logLine, index) => (
                  <li key={index} className="text-gray-200 break-words">
                    {logLine}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border-indigo-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-indigo-300 mb-4">Recommendation</h3>
              <p className="text-gray-200 text-lg">
                {result.isReal
                  ? 'The backend model classified this audio as real. Review the confidence score and logs above before trusting sensitive voice content.'
                  : 'The backend model classified this audio as fake. Review the confidence score and logs above before making a final moderation or trust decision.'}
              </p>
            </Card>
          </div>
        )}
      </div>

      <footer className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 py-6 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-300 text-lg">
            Team: <span className="text-orange-400 font-semibold">CODE CLUCTURES</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
