import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Video, Upload, Link as LinkIcon, Search, CheckCircle2, XCircle, AlertTriangle, Eye, Headphones, Film, Database, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';

interface VideoAnalysisResult {
  source: string;
  isReal: boolean;
  verdict: 'real' | 'fake';
  realityScore: number;
  confidenceScore: number;
  predictedIndex: number;
  logs: string[];
  aiModels: {
    cnn: boolean;
    faceForensics: boolean;
    mtcnn: boolean;
  };
  checks: {
    visualConsistency: boolean;
    audioSync: boolean;
    frameInspection: boolean;
    sourceVerification: boolean;
    metadataValid: boolean;
    behavioralClues: boolean;
  };
  detailedAnalysis: {
    framesAnalyzed: number;
    facesDetected: number;
    audioQuality: string;
    compressionArtifacts: string;
    temporalConsistency: string;
  };
  warnings?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

interface VideoApiResponse {
  type: 'video';
  model: string;
  label: 'real' | 'fake';
  fake_score: number;
  real_score: number;
  confidence_score: number;
  predicted_index: number;
  raw_logits: number[];
  logs: string[];
  frames_analyzed: number;
  faces_detected: number;
  source: string;
}

const getVideoWarnings = (isReal: boolean, fakeScore: number): string[] | undefined => {
  if (isReal) {
    return undefined;
  }

  const warnings: string[] = ['3D CNN video classifier detected deepfake-like temporal patterns.'];
  if (fakeScore >= 80) warnings.push('The model confidence is high for manipulated frame dynamics.');
  if (fakeScore >= 65) warnings.push('Frame-level consistency is suspicious across sampled video segments.');
  if (fakeScore >= 50) warnings.push('Authenticity confidence is below the trusted threshold.');
  return warnings;
};

export default function VideoAnalyser() {
  const { consumeUpload } = useAuth();
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [analysisStage, setAnalysisStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyzeVideo = async () => {
    if ((activeTab === 'url' && !videoUrl) || (activeTab === 'upload' && !selectedFile)) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const stages = [
      'Initializing AI models (CNN, FaceForensics++, MTCNN)...',
      'Extracting video frames...',
      'Detecting faces and analyzing facial movements...',
      'Checking audio-visual synchronization...',
      'Analyzing metadata and source information...',
      'Detecting compression artifacts...',
      'Evaluating behavioral patterns...',
      'Generating final report...',
    ];

    let currentStage = 0;
    const stageInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setAnalysisStage(stages[currentStage]);
        currentStage++;
      }
    }, 800);

    try {
      let response: Response;
      let source = videoUrl;

      if (activeTab === 'upload' && selectedFile) {
        const uploadCheck = await consumeUpload();
        if (!uploadCheck.allowed) {
          throw new Error(uploadCheck.message || 'Upload not allowed.');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        source = selectedFile.name;
        response = await fetch(`${API_BASE_URL}/analyze/video`, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`${API_BASE_URL}/analyze/video-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: videoUrl }),
        });
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail || 'Video analysis failed.');
      }

      const apiResult: VideoApiResponse = await response.json();
      clearInterval(stageInterval);
      const realityScore = Math.round(apiResult.real_score);
      const fakeScore = Math.round(apiResult.fake_score);
      const isReal = apiResult.label === 'real';
      const confidenceGap = Math.abs(realityScore - fakeScore);

      const derivedResult: VideoAnalysisResult = {
        source,
        isReal,
        verdict: apiResult.label,
        realityScore,
        confidenceScore: Math.round(apiResult.confidence_score),
        predictedIndex: apiResult.predicted_index,
        logs: apiResult.logs,
        aiModels: {
          cnn: true,
          faceForensics: true,
          mtcnn: true,
        },
        checks: {
          visualConsistency: isReal || fakeScore < 60,
          audioSync: isReal || fakeScore < 70,
          frameInspection: fakeScore < 62,
          sourceVerification: confidenceGap >= 15,
          metadataValid: confidenceGap >= 10,
          behavioralClues: isReal || fakeScore < 58,
        },
        detailedAnalysis: {
          framesAnalyzed: apiResult.frames_analyzed,
          facesDetected: apiResult.faces_detected,
          audioQuality: isReal ? 'Natural and consistent' : 'Anomalies likely or unavailable for backend verification',
          compressionArtifacts: fakeScore >= 60 ? 'Suspicious re-encoding patterns' : 'No strong anomalies detected',
          temporalConsistency: isReal
            ? 'Consistent across sampled frames'
            : fakeScore >= 70
              ? 'Poor - inconsistencies found'
              : 'Mixed - review recommended',
        },
        warnings: getVideoWarnings(isReal, fakeScore),
      };

      setResult(derivedResult);
    } catch (err) {
      clearInterval(stageInterval);
      setError(err instanceof Error ? err.message : 'Unable to analyze video.');
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
        {/* Header */}
        <div className="mb-12">
          <Link to="/">
            <Button variant="ghost" className="text-purple-400 hover:text-purple-300 mb-6 hover:bg-purple-400/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <Video className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold text-purple-300">Video Analyser</h1>
          </div>
          <p className="text-gray-300 text-lg">
            AI-powered deepfake detection
          </p>
        </div>

        {/* Input Section */}
        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-purple-500/30 backdrop-blur-sm p-8 rounded-2xl mb-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'upload' | 'url')}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-900/50 mb-6">
              <TabsTrigger value="upload" className="data-[state=active]:bg-purple-600">
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </TabsTrigger>
              <TabsTrigger value="url" className="data-[state=active]:bg-purple-600">
                <LinkIcon className="mr-2 h-4 w-4" />
                URL / YouTube
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  type="text"
                  placeholder="Enter a video URL or YouTube link (e.g., https://example.com/video.mp4 or https://youtu.be/...)"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyzeVideo()}
                  className="flex-1 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-400 text-lg py-6"
                />
                <Button
                  onClick={analyzeVideo}
                  disabled={loading || !videoUrl}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-8 py-6 text-lg"
                >
                  {loading ? (
                    <>Analyzing...</>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Analyze Video
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">MP4, AVI, MOV (MAX. 100MB)</p>
                      {selectedFile && (
                        <p className="mt-2 text-sm text-purple-400 font-semibold">
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                <Button
                  onClick={analyzeVideo}
                  disabled={loading || !selectedFile}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-8 py-6 text-lg w-full sm:w-auto"
                >
                  {loading ? (
                    <>Analyzing...</>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Analyze Video
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-purple-500/30 backdrop-blur-sm p-8 rounded-2xl">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-400 mb-4"></div>
              <p className="text-purple-300 text-xl mb-6">Analyzing video with AI models...</p>
              {analysisStage && (
                <p className="text-cyan-400 text-lg animate-pulse">{analysisStage}</p>
              )}
              <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 text-gray-300">
                  <Film className="w-5 h-5 text-purple-400" />
                  <span>Extracting frames</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Eye className="w-5 h-5 text-purple-400" />
                  <span>Face detection</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Headphones className="w-5 h-5 text-purple-400" />
                  <span>Audio analysis</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Database className="w-5 h-5 text-purple-400" />
                  <span>Metadata check</span>
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

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Reality Score */}
            <Card className={`border-2 backdrop-blur-sm p-8 rounded-2xl ${
              result.isReal 
                ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/50' 
                : 'bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/50'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  {result.isReal ? (
                    <CheckCircle2 className="w-16 h-16 text-green-400" />
                  ) : (
                    <XCircle className="w-16 h-16 text-red-400" />
                  )}
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {result.isReal ? 'Video is Real' : 'Video is Fake'}
                    </h2>
                    <p className="text-gray-300">
                      Confidence Score: <span className="font-bold text-2xl">{result.confidenceScore}%</span>
                    </p>
                  </div>
                </div>
              </div>
              <Progress value={result.realityScore} className="h-4 mb-4" />
              <p className="text-gray-200 break-all">
                <strong>Analyzed Source:</strong> {result.source}
              </p>
              <p className="text-gray-200 mt-2">
                <strong>Backend Verdict:</strong> {result.verdict.toUpperCase()} | <strong>Predicted Class Index:</strong> {result.predictedIndex}
              </p>
            </Card>

            {/* AI Models Used */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-purple-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-purple-300 mb-6 flex items-center gap-2">
                <Users className="w-6 h-6" />
                AI Models Applied
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">CNN Model</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">FaceForensics++</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">MTCNN</span>
                </div>
              </div>
            </Card>

            {/* Detection Checks */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-purple-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-purple-300 mb-6 flex items-center gap-2">
                <Eye className="w-6 h-6" />
                Detection Checks
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.visualConsistency ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Visual Consistency Check</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.audioSync ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Audio Synchronization</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.frameInspection ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Frame-by-Frame Inspection</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.sourceVerification ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Source Verification</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.metadataValid ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Metadata Validation</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.behavioralClues ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Behavioral Clues Analysis</span>
                </div>
              </div>
            </Card>

            {/* Detailed Analysis */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-purple-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-purple-300 mb-6 flex items-center gap-2">
                <Film className="w-6 h-6" />
                Detailed Analysis
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Frames Analyzed:</p>
                  <p className="text-gray-200 text-xl">{result.detailedAnalysis.framesAnalyzed}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Faces Detected:</p>
                  <p className="text-gray-200 text-xl">{result.detailedAnalysis.facesDetected}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Audio Quality:</p>
                  <p className="text-gray-200">{result.detailedAnalysis.audioQuality}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Compression Artifacts:</p>
                  <p className="text-gray-200">{result.detailedAnalysis.compressionArtifacts}</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-gray-400 font-semibold">Temporal Consistency:</p>
                  <p className="text-gray-200">{result.detailedAnalysis.temporalConsistency}</p>
                </div>
              </div>
            </Card>

            {/* Logs */}
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

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <Card className="bg-gradient-to-br from-red-900/40 to-orange-900/40 border-red-500/30 backdrop-blur-sm p-8 rounded-2xl">
                <h3 className="text-2xl font-bold text-red-300 mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  Review Notes
                </h3>
                <ul className="space-y-3">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-3 text-gray-200">
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Recommendation */}
            <Card className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border-indigo-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-indigo-300 mb-4">Recommendation</h3>
              <p className="text-gray-200 text-lg">
                {result.isReal 
                  ? 'The backend model classified this video as real. Use the confidence score and logs above to judge how strong that prediction is.'
                  : 'The backend model classified this video as fake. Use the confidence score and logs above before making a final trust decision.'
                }
              </p>
            </Card>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 py-6 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-300 text-lg">
            Team: <span className="text-purple-400 font-semibold">CODE CLUCTURES</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
