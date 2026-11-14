import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiVideo, FiMenu, FiUser, FiLogOut, FiSettings, FiFileText, FiSun, FiMoon, FiHome } from 'react-icons/fi';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return (
      <nav className="bg-surface-color border-b border-border-color">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-color rounded-lg flex items-center justify-center">
                <FiVideo className="text-background-color text-lg" />
              </div>
              <span className="text-xl font-bold text-text-primary">SmartMeet</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link to="/login" className="btn btn-secondary">
                Login
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-surface-color border-b border-border-color">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-primary-color rounded-lg flex items-center justify-center">
              <FiVideo className="text-background-color text-base" />
            </div>
            <span className="text-lg font-bold text-text-primary flex items-center">
              <FiHome className="mr-1" /> SmartMeet
            </span>
          </Link>
          
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="btn btn-secondary btn-xs flex items-center space-x-1">
              <FiFileText />
              <span className="hidden sm:inline">Documents</span>
            </Link>
            <Link to="/settings" className="btn btn-secondary btn-xs flex items-center space-x-1">
              <FiSettings />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-1 btn btn-secondary btn-xs px-2 py-1"
                title={user?.name}
              >
                <img 
                  src={user?.avatar} 
                  alt={user?.name}
                  className="w-5 h-5 rounded-full object-cover border border-border-color"
                />
                <span className="text-xs font-medium text-text-primary truncate max-w-[60px]">
                  {user?.name}
                </span>
                <FiMenu />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-surface-color border border-border-color rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <button className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-border-color flex items-center space-x-2">
                      <FiUser />
                      <span>Profile</span>
                    </button>
                    <Link to="/settings" className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-border-color flex items-center space-x-2">
                      <FiSettings />
                      <span>Settings</span>
                    </Link>
                    <hr className="border-border-color my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-xs text-danger-color hover:bg-border-color flex items-center space-x-2"
                    >
                      <FiLogOut />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              className="btn btn-icon ml-1"
              onClick={() => setDarkMode(dm => !dm)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <FiSun /> : <FiMoon />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 