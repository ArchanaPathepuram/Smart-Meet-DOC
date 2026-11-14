import React from 'react';

const FormLayout = ({ children, title, subtitle, icon }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-indigo-100 to-pink-200 py-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        {icon && (
          <div className="mx-auto h-14 w-14 bg-primary-color rounded-full flex items-center justify-center mb-4 shadow-md">
            {icon}
          </div>
        )}
        {title && <h2 className="text-3xl font-bold text-text-primary mb-2">{title}</h2>}
        {subtitle && <p className="text-text-secondary mb-2">{subtitle}</p>}
      </div>
      <div className="card mt-4">{children}</div>
    </div>
  </div>
);

export default FormLayout; 