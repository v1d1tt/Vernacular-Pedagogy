import React from 'react';
import { Globe, Upload, Zap, FileText, Video } from 'lucide-react';

const Dashboard = () => {
  const features = [
    {
      icon: <Upload className="w-12 h-12 text-blue-600" />,
      title: "Instant Upload",
      description: "Direct YouTube integration",
      subtitle: "SEAMLESS"
    },
    {
      icon: <Globe className="w-12 h-12 text-blue-600" />,
      title: "50+ Languages",
      description: "AI voice synthesis support",
      subtitle: "SUPPORTED"
    },
    {
      icon: <Zap className="w-12 h-12 text-blue-600" />,
      title: "Fast Processing",
      description: "Get dubbed videos in minutes",
      subtitle: "PROCESSING"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-blue-900">Your content,</span>
            <span className="text-blue-400"> always translated perfectly</span>
          </h1>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center"
            >
              <div className="bg-blue-50 p-4 rounded-2xl mb-6">
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-blue-600 mb-2">
                {feature.subtitle}
              </h3>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {feature.title}
              </h2>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-3xl p-8 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Text Input Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">Text Input</h3>
              </div>
              <textarea 
                className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your blog content..."
              />
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <span>Or upload a file:</span>
                <input type="file" className="text-sm" />
              </div>
            </div>

            {/* Video Input Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 mb-4">
                <Video className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">Video Input</h3>
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Video className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Drag and drop video files here</p>
                <p className="text-sm text-gray-500 mt-2">or</p>
                <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
                  Browse Files
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center mt-8">
          <button className="bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors">
            Start Processing
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;