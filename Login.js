import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiMail, FiLock, FiEye, FiEyeOff, FiLogIn } from 'react-icons/fi';
import FormLayout from './FormLayout';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        navigate('/');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-200 dark:from-black dark:via-gray-900 dark:to-gray-800">
      <div className="w-full max-w-xs mx-auto">
        <FormLayout
          title={<span className="text-2xl font-bold tracking-tight flex items-center"><FiLogIn className="mr-2" />Login</span>}
          subtitle={<span className="text-sm text-text-secondary">Sign in to Meet-Doc</span>}
          icon={<FiLogIn className="text-white text-3xl" />}
        >
          <div className="card rounded-2xl shadow-lg p-6 mt-2">
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="form-group">
                <label htmlFor="email" className="form-label text-base font-semibold">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="h-5 w-5 text-text-secondary" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={`form-input pl-10 text-lg rounded-xl ${errors.email ? 'error' : ''}`}
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                {errors.email && (
                  <p className="error-message">{errors.email}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label text-base font-semibold">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-text-secondary" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className={`form-input pl-10 pr-10 ${errors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-5 w-5 text-text-secondary hover:text-text-primary" />
                    ) : (
                      <FiEye className="h-5 w-5 text-text-secondary hover:text-text-primary" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="error-message">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-color" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface-color text-text-secondary">Demo credentials</span>
                </div>
              </div>
              <div className="mt-4 text-center text-sm text-text-secondary">
                <p>Email: demo@smartmeet.com</p>
                <p>Password: password</p>
              </div>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-xs text-text-secondary">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-primary-color hover:text-primary-hover">
                Sign up here
              </Link>
            </p>
          </div>
        </FormLayout>
      </div>
    </div>
  );
};

export default Login; 