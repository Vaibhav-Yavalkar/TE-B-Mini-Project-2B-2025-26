import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Shield, Check, Crown, Zap, Rocket, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    icon: Shield,
    color: 'from-gray-500 to-gray-600',
    borderColor: 'border-gray-500/30',
    features: [
      '4 total file uploads',
      'Basic AI models',
      'Text, image, audio, and video analysis',
      'Email support',
      'Standard processing speed',
    ],
    limitations: [
      'Limited daily scans',
      'No priority support',
      'No API access',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    icon: Zap,
    color: 'from-cyan-500 to-blue-600',
    borderColor: 'border-cyan-500/50',
    features: [
      '100 scans per day',
      'Advanced AI models',
      'All analysis types',
      'Video analysis (1080p)',
      'Plagiarism check (5,000 words)',
      'Priority email support',
      'Fast processing speed',
      'Detailed reports',
      'Export results (PDF)',
    ],
    limitations: [],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 29.99,
    icon: Crown,
    color: 'from-purple-500 to-pink-600',
    borderColor: 'border-purple-500/50',
    popular: true,
    features: [
      'Unlimited scans',
      'Premium AI models (99.9% accuracy)',
      'All analysis types',
      'Video analysis (4K)',
      'Plagiarism check (unlimited)',
      '24/7 priority support',
      'Fastest processing',
      'Advanced detailed reports',
      'Export results (PDF, JSON)',
      'Batch processing',
      'API access (1,000 calls/day)',
      'Custom model training',
    ],
    limitations: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99.99,
    icon: Rocket,
    color: 'from-orange-500 to-red-600',
    borderColor: 'border-orange-500/50',
    features: [
      'Everything in Premium',
      'Unlimited API calls',
      'Dedicated account manager',
      'Custom integrations',
      'White-label solutions',
      'On-premise deployment option',
      'SLA guarantee',
      'Custom AI model development',
      'Advanced analytics dashboard',
      'Team collaboration tools',
      'Multi-user accounts',
      'Custom branding',
    ],
    limitations: [],
  },
];

export default function Subscription() {
  const { user, updateSubscription } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      navigate('/signup');
      return;
    }

    setError('');
    setSelectedPlan(planId);
    const success = await updateSubscription(planId as 'free' | 'basic' | 'premium' | 'enterprise');
    setSelectedPlan(null);
    if (!success) {
      setError('Unable to update subscription right now. Please try again.');
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2350] to-[#1a2b5f]">
      <Header />
      
      <div className="container mx-auto px-6 py-12">
        <Link to="/">
          <Button variant="ghost" className="text-purple-400 hover:text-purple-300 mb-6 hover:bg-purple-400/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Crown className="w-12 h-12 text-purple-400" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">Choose Your Plan</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Unlock the full power of DeepTrust with advanced AI detection and unlimited scans
          </p>
          {user && (
            <div className="mt-4 inline-block bg-gray-800/50 px-6 py-3 rounded-lg border border-gray-700">
              <p className="text-gray-300">
                Current Plan: <span className="text-purple-400 font-bold capitalize">{user.subscription}</span>
              </p>
              {user.uploadLimit !== null && (
                <p className="text-sm text-orange-300 mt-1">
                  {user.uploadsRemaining} of {user.uploadLimit} free uploads remaining
                </p>
              )}
            </div>
          )}
          {error && (
            <div className="mt-4 inline-block bg-red-500/10 px-6 py-3 rounded-lg border border-red-500/50">
              <p className="text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = user?.subscription === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-2 ${plan.borderColor} backdrop-blur-sm p-6 rounded-2xl transition-all duration-300 hover:scale-105 ${
                  plan.popular ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      Most Popular
                    </div>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                      Current Plan
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${plan.color} rounded-xl mb-4`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-200 text-sm">
                      <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrentPlan || selectedPlan === plan.id}
                  className={`w-full bg-gradient-to-r ${plan.color} hover:opacity-90 text-white py-6 text-lg ${
                    isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {selectedPlan === plan.id ? (
                    'Processing...'
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : plan.price === 0 ? (
                    'Get Started'
                  ) : (
                    'Subscribe Now'
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-purple-500/30 backdrop-blur-sm p-8 rounded-2xl mb-12">
          <h2 className="text-3xl font-bold text-center text-purple-300 mb-8">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-4 px-4 text-gray-300">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-300">Free</th>
                  <th className="text-center py-4 px-4 text-cyan-300">Basic</th>
                  <th className="text-center py-4 px-4 text-purple-300">Premium</th>
                  <th className="text-center py-4 px-4 text-orange-300">Enterprise</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4">Daily Scans</td>
                  <td className="text-center py-4 px-4">4 uploads</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4">AI Model Accuracy</td>
                  <td className="text-center py-4 px-4">95%</td>
                  <td className="text-center py-4 px-4">97%</td>
                  <td className="text-center py-4 px-4">99.9%</td>
                  <td className="text-center py-4 px-4">99.9%+</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4">Video Quality Support</td>
                  <td className="text-center py-4 px-4">480p</td>
                  <td className="text-center py-4 px-4">1080p</td>
                  <td className="text-center py-4 px-4">4K</td>
                  <td className="text-center py-4 px-4">8K</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4">Plagiarism Check Words</td>
                  <td className="text-center py-4 px-4">500</td>
                  <td className="text-center py-4 px-4">5,000</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4">API Access</td>
                  <td className="text-center py-4 px-4">-</td>
                  <td className="text-center py-4 px-4">-</td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4">Priority Support</td>
                  <td className="text-center py-4 px-4">-</td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-4">Custom AI Training</td>
                  <td className="text-center py-4 px-4">-</td>
                  <td className="text-center py-4 px-4">-</td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="w-5 h-5 text-green-400 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* FAQ */}
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30 backdrop-blur-sm p-8 rounded-2xl">
          <h2 className="text-3xl font-bold text-center text-indigo-200 mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Can I upgrade or downgrade anytime?</h4>
              <p className="text-gray-300">Yes, you can change your plan at any time. Changes take effect immediately.</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Is there a free trial for premium plans?</h4>
              <p className="text-gray-300">Premium and Enterprise plans come with a 7-day free trial. No credit card required.</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">What payment methods do you accept?</h4>
              <p className="text-gray-300">We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">Is my data secure?</h4>
              <p className="text-gray-300">Yes, all data is encrypted end-to-end and we never store your analyzed content.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 py-6 mt-16">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-300 text-lg">
            Team: <span className="text-purple-400 font-semibold">Technically Techie</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
