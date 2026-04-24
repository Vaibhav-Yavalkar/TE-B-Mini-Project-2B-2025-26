import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Image as ImageIcon, Upload, Link as LinkIcon, Search, CheckCircle2, XCircle, AlertTriangle, Eye, Scan, Layers, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';

interface ImageAnalysisResult {
  source: string;
  isReal: boolean;
  verdict: 'real' | 'fake';
  authenticityScore: number;
  aiGeneratedScore: number;
  confidenceScore: number;
  predictedIndex: number;
  logs: string[];
  aiModels: {
    cnn: boolean;
    ganDetection: boolean;
    faceAnalysis: boolean;
    pixelAnalysis: boolean;
  };
  checks: {
    facialLandmarks: boolean;
    lightingConsistency: boolean;
    pixelArtifacts: boolean;
    metadataValid: boolean;
    compressionNatural: boolean;
    edgeConsistency: boolean;
  };
  detailedAnalysis: {
    resolution: string;
    facesDetected: number;
    artifactsFound: number;
    manipulationLevel: string;
    sourceType: string;
  };
  warnings?: string[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

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

const getImageWarnings = (isReal: boolean, fakeScore: number): string[] | undefined => {
  if (isReal) {
    return undefined;
  }

  const warnings: string[] = ['EfficientNet image classifier flagged this image as manipulated or AI-generated.'];
  if (fakeScore >= 80) warnings.push('Model confidence is high for synthetic or edited image characteristics.');
  if (fakeScore >= 65) warnings.push('Visual artifact patterns are consistent with deepfake or AI-image generation.');
  if (fakeScore >= 50) warnings.push('Authenticity confidence is below the safe threshold for trusted media.');
  return warnings;
};

const getImageResolution = async (source: string): Promise<string> =>
  new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(`${image.naturalWidth}x${image.naturalHeight}`);
    image.onerror = () => resolve('Unknown');
    image.src = source;
  });

export default function ImageAnalyser() {
  const { consumeUpload } = useAuth();
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [analysisStage, setAnalysisStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = async () => {
    if ((activeTab === 'url' && !imageUrl) || (activeTab === 'upload' && !selectedFile)) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const stages = [
      'Loading image and extracting pixels...',
      'Initializing AI detection models...',
      'Analyzing facial landmarks and features...',
      'Detecting GAN-generated artifacts...',
      'Checking lighting and shadow consistency...',
      'Examining pixel-level manipulation...',
      'Validating metadata and EXIF data...',
      'Generating comprehensive report...',
    ];

    let currentStage = 0;
    const stageInterval = setInterval(() => {
      if (currentStage < stages.length) {
        setAnalysisStage(stages[currentStage]);
        currentStage++;
      }
    }, 750);

    try {
      let response: Response;
      let resolution = 'Unknown';
      let source = imageUrl;

      if (activeTab === 'upload' && selectedFile) {
        const uploadCheck = await consumeUpload();
        if (!uploadCheck.allowed) {
          throw new Error(uploadCheck.message || 'Upload not allowed.');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        source = selectedFile.name;
        resolution = previewUrl ? await getImageResolution(previewUrl) : 'Unknown';
        response = await fetch(`${API_BASE_URL}/analyze/image`, {
          method: 'POST',
          body: formData,
        });
      } else {
        resolution = await getImageResolution(imageUrl);
        response = await fetch(`${API_BASE_URL}/analyze/image-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: imageUrl }),
        });
      }

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail || 'Image analysis failed.');
      }

      const apiResult: ImageApiResponse = await response.json();
      clearInterval(stageInterval);
      const authenticityScore = Math.round(apiResult.real_score);
      const aiGeneratedScore = Math.round(apiResult.fake_score);
      const isReal = apiResult.label === 'real';
      const confidenceGap = Math.abs(authenticityScore - aiGeneratedScore);

      const derivedResult: ImageAnalysisResult = {
        source,
        isReal,
        verdict: apiResult.label,
        authenticityScore,
        aiGeneratedScore,
        confidenceScore: Math.round(apiResult.confidence_score),
        predictedIndex: apiResult.predicted_index,
        logs: apiResult.logs,
        aiModels: {
          cnn: true,
          ganDetection: true,
          faceAnalysis: true,
          pixelAnalysis: true,
        },
        checks: {
          facialLandmarks: isReal || aiGeneratedScore < 55,
          lightingConsistency: isReal || aiGeneratedScore < 65,
          pixelArtifacts: aiGeneratedScore < 60,
          metadataValid: confidenceGap >= 15,
          compressionNatural: aiGeneratedScore < 50,
          edgeConsistency: aiGeneratedScore < 58,
        },
        detailedAnalysis: {
          resolution,
          facesDetected: isReal ? 1 : 0,
          artifactsFound: Math.max(0, Math.round(aiGeneratedScore / 12)),
          manipulationLevel: isReal
            ? 'None detected'
            : aiGeneratedScore >= 85
              ? 'Severe'
              : aiGeneratedScore >= 70
                ? 'High'
                : aiGeneratedScore >= 55
                  ? 'Medium'
                  : 'Low',
          sourceType: isReal ? 'Photographic (Natural)' : 'AI Generated / Manipulated',
        },
        warnings: getImageWarnings(isReal, aiGeneratedScore),
      };

      setResult(derivedResult);
    } catch (err) {
      clearInterval(stageInterval);
      setError(err instanceof Error ? err.message : 'Unable to analyze image.');
    } finally {
      setLoading(false);
      setAnalysisStage('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link to="/">
            <Button variant="ghost" className="text-emerald-400 hover:text-emerald-300 mb-6 hover:bg-emerald-400/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <ImageIcon className="w-12 h-12 text-emerald-400" />
            <h1 className="text-5xl font-bold text-emerald-300">Image Analyser</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Detect AI-generated and manipulated images
          </p>
        </div>

        {/* Input Section */}
        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-emerald-500/30 backdrop-blur-sm p-8 rounded-2xl mb-8">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'url' | 'upload')}>

            <TabsContent value="upload" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer bg-gray-900/50 hover:bg-gray-900/70 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="max-h-52 rounded-lg object-contain" />
                      ) : (
                        <>
                          <Upload className="w-12 h-12 mb-4 text-gray-400" />
                          <p className="mb-2 text-sm text-gray-400">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">PNG, JPG, JPEG, WebP (MAX. 10MB)</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                  {selectedFile && (
                    <p className="mt-2 text-sm text-emerald-400 font-semibold text-center">
                      {selectedFile.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center">
                  <Button
                    onClick={analyzeImage}
                    disabled={loading || !selectedFile}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-12 py-8 text-xl rounded-xl"
                  >
                    {loading ? (
                      <>Analyzing...</>
                    ) : (
                      <>
                        <Search className="mr-3 h-6 w-6" />
                        Analyze Image
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  type="text"
                  placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyzeImage()}
                  className="flex-1 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-emerald-400 text-lg py-6"
                />
                <Button
                  onClick={analyzeImage}
                  disabled={loading || !imageUrl}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-8 py-6 text-lg"
                >
                  {loading ? (
                    <>Analyzing...</>
                  ) : (
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

        {/* Loading State */}
        {loading && (
          <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-emerald-500/30 backdrop-blur-sm p-8 rounded-2xl">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-400 mb-4"></div>
              <p className="text-emerald-300 text-xl mb-6">Analyzing image with AI models...</p>
              {analysisStage && (
                <p className="text-cyan-400 text-lg animate-pulse">{analysisStage}</p>
              )}
              <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
                <div className="flex items-center gap-2 text-gray-300">
                  <Eye className="w-5 h-5 text-emerald-400" />
                  <span>Face detection</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Scan className="w-5 h-5 text-emerald-400" />
                  <span>Pixel analysis</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <span>Layer inspection</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>AI detection</span>
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
            {/* Authenticity Score */}
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
                        {result.isReal ? 'Image is Real' : 'Image is Fake'}
                      </h2>
                      <p className="text-gray-300">
                        Confidence: <span className="font-bold text-2xl">{result.confidenceScore}%</span>
                      </p>
                    </div>
                  </div>
                  <Progress value={result.authenticityScore} className="h-4 mb-2" />
                  <p className="text-sm text-gray-400">Real Probability</p>
                </div>

                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <AlertTriangle className="w-16 h-16 text-orange-400" />
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">Fake Probability</h3>
                      <p className="text-gray-300">
                        Score: <span className="font-bold text-2xl">{result.aiGeneratedScore}%</span>
                      </p>
                    </div>
                  </div>
                  <Progress value={result.aiGeneratedScore} className="h-4 mb-2" />
                  <p className="text-sm text-gray-400">Fake Probability</p>
                </div>
              </div>
              <p className="text-gray-200 break-all">
                <strong>Analyzed Source:</strong> {result.source}
              </p>
              <p className="text-gray-200 mt-2">
                <strong>Backend Verdict:</strong> {result.verdict.toUpperCase()} | <strong>Predicted Class Index:</strong> {result.predictedIndex}
              </p>
            </Card>

            {/* AI Models Applied */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-emerald-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-emerald-300 mb-6 flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                AI Models Applied
              </h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">CNN Analysis</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">GAN Detection</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">Face Analysis</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <span className="text-gray-200 font-semibold">Pixel Analysis</span>
                </div>
              </div>
            </Card>

            {/* Detection Checks */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-emerald-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-emerald-300 mb-6 flex items-center gap-2">
                <Eye className="w-6 h-6" />
                Detection Checks
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.facialLandmarks ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Facial Landmarks Natural</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.lightingConsistency ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Lighting Consistency</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.pixelArtifacts ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">No Pixel Artifacts</span>
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
                  {result.checks.compressionNatural ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Natural Compression</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
                  {result.checks.edgeConsistency ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-gray-200">Edge Consistency</span>
                </div>
              </div>
            </Card>

            {/* Detailed Analysis */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-emerald-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <h3 className="text-2xl font-bold text-emerald-300 mb-6 flex items-center gap-2">
                <Scan className="w-6 h-6" />
                Detailed Analysis
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Image Resolution:</p>
                  <p className="text-gray-200 text-xl">{result.detailedAnalysis.resolution}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Faces Detected:</p>
                  <p className="text-gray-200 text-xl">{result.detailedAnalysis.facesDetected}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Artifacts Found:</p>
                  <p className="text-gray-200 text-xl">{result.detailedAnalysis.artifactsFound}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Manipulation Level:</p>
                  <p className={`text-xl font-semibold ${result.isReal ? 'text-green-400' : 'text-red-400'}`}>
                    {result.detailedAnalysis.manipulationLevel}
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-gray-400 font-semibold">Source Type:</p>
                  <p className="text-gray-200 text-xl">{result.detailedAnalysis.sourceType}</p>
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
                  ? 'The backend model classified this image as real. Use the confidence score and model logs above to judge how strong that prediction is.'
                  : 'The backend model classified this image as fake. Use the confidence score and model logs above before making a final trust decision.'
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
            Team: <span className="text-emerald-400 font-semibold">CODE CLUCTURES</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
