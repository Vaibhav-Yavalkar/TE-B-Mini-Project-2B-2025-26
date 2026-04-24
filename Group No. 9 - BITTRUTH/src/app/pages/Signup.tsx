import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Shield, Mail, Lock, User, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const success = await signup(name, email, password);
      if (success) {
        navigate('/');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <Header />
      
      <div className="container mx-auto px-6 py-12">
        <Link to="/">
          <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 mb-6 hover:bg-cyan-400/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Shield className="w-12 h-12 text-cyan-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Create Your Account</h1>
            <p className="text-gray-400">Join DeepTrust and protect yourself from digital deception</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Signup Form */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-cyan-500/30 backdrop-blur-sm p-8 rounded-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="pl-12 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-12 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-12 pr-12 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-300">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-12 bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <input type="checkbox" required className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 mt-1" />
                  <span className="text-sm text-gray-400">
                    I agree to the <a href="#" className="text-cyan-400 hover:text-cyan-300">Terms of Service</a> and{' '}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>
                  </span>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-6 text-lg"
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </Button>

                <div className="text-center">
                  <p className="text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                      Login
                    </Link>
                  </p>
                </div>
              </form>
            </Card>

            {/* Benefits */}
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-cyan-500/30 backdrop-blur-sm p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-cyan-300 mb-4">Free Plan Includes:</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>4 file uploads on the free plan</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>Text, image, audio, and video analysis</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>Standard accuracy AI models</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>Email support</span>
                  </li>
                </ul>
              </Card>

              <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-500/30 backdrop-blur-sm p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-purple-300 mb-4">Why Choose DeepTrust?</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>99.9% accuracy with advanced AI models</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Real-time deepfake detection</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Comprehensive security analysis</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Trusted by thousands of users</span>
                  </li>
                </ul>
              </Card>

              <div className="text-center">
                <Link to="/subscription">
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-8 py-4">
                    View Premium Plans
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 py-6 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-300 text-lg">
            Team: <span className="text-cyan-400 font-semibold">Technically Techie</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
