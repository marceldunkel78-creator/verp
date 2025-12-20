import React from 'react';

const ComingSoon = ({ moduleName, description }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{moduleName}</h1>
        <p className="text-lg text-gray-600 mb-8">{description}</p>
        <div className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-orange-600">
          Coming Soon
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Dieses Modul befindet sich in Entwicklung
        </p>
      </div>
    </div>
  );
};

export default ComingSoon;
