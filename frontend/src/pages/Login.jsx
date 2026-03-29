import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../utils/firebaseClient';
import '../styles/Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Check if user is already logged in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email && user.email.endsWith('@scaler.com')) {
          navigate('/admin/dashboard');
        } else {
          await signOut(auth);
          setError('Only @scaler.com emails are allowed.');
        }
      }
    });

    // 2. Check if we are returning from an email link
    const handleEmailLinkLogin = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let savedEmail = window.localStorage.getItem('emailForSignIn');
        if (!savedEmail) {
          savedEmail = window.prompt('Please provide your email for confirmation');
        }
        
        if (savedEmail) {
          setIsLoading(true);
          try {
            const result = await signInWithEmailLink(auth, savedEmail, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            
            // Domain check
            if (result.user.email && result.user.email.endsWith('@scaler.com')) {
              navigate('/admin/dashboard');
            } else {
              await signOut(auth);
              setError('Only @scaler.com emails are allowed.');
            }
          } catch (err) {
            console.error('Error signing in with email link', err);
            setError(err.message || 'Error processing the login link. It may have expired.');
          } finally {
            setIsLoading(false);
          }
        }
      }
    };

    handleEmailLinkLogin();

    return () => unsubscribe();
  }, [navigate]);

  const validateEmail = (e) => {
    if (!e) return 'Email is required';
    if (!e.endsWith('@scaler.com')) {
      return 'Only @scaler.com emails are allowed';
    }
    return null;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    const actionCodeSettings = {
      // URL you want to redirect back to. Ensure the domain for this
      // URL is explicitly whitelisted in the Firebase console.
      url: `${window.location.origin}/admin/login`,
      handleCodeInApp: true,
    };

    try {
      if (!auth) throw new Error("Firebase Auth is not initialized. Check your credentials.");
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setMessage('Check your email for the magic login link!');
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Failed to send login link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <a href="/" className="premium-logo login-logo" aria-label="Scaler Homepage">
             <svg className="scaler-official-logo" viewBox="0 0 1324 280" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1147.8 228.928C1147.58 228.163 1147.43 227.38 1147.35 226.588C1147.35 195.638 1147.35 164.685 1147.35 133.728C1147.35 132.188 1147.27 130.638 1147.35 129.107C1147.48 127.177 1148.36 125.377 1149.81 124.096C1156.13 117.876 1162.49 111.695 1168.78 105.436C1181.25 92.9706 1193.71 80.4789 1206.15 67.9611C1210.83 63.2881 1215.52 58.6475 1220.23 54.0395C1220.93 53.4591 1221.68 52.9374 1222.46 52.4796H1323.1C1323.4 53.2759 1323.6 54.1037 1323.7 54.9461C1323.7 86.3121 1323.7 117.671 1323.7 149.024C1323.74 149.682 1323.84 150.334 1324 150.974V154.065C1322.96 155.235 1321.97 156.463 1320.87 157.574C1316.55 161.929 1312.22 166.264 1307.87 170.58C1302.33 176.049 1296.72 181.45 1291.21 186.938C1278.13 199.976 1265.07 213.024 1252.02 226.081C1251.05 227.114 1249.84 228.031 1248.75 229.006L1147.8 228.928ZM1249.37 217.901L1250.1 218.418C1252.18 216.127 1254.17 213.739 1256.34 211.545C1265.13 202.738 1273.95 193.964 1282.79 185.223C1283.28 184.772 1283.66 184.221 1283.91 183.608C1284.15 182.995 1284.27 182.335 1284.23 181.674C1284.19 152.992 1284.19 124.314 1284.23 95.6386C1284.23 95.3267 1284.23 95.0147 1284.23 94.6637C1284.29 93.2599 1283.87 92.6164 1282.22 92.6164C1253.22 92.6749 1224.22 92.6749 1195.22 92.6164C1194.55 92.5983 1193.89 92.7219 1193.27 92.979C1192.66 93.2362 1192.1 93.621 1191.65 94.108C1181.29 104.507 1170.93 114.867 1160.57 125.188C1160.23 125.529 1159.92 125.909 1159.35 126.553H1249.4L1249.37 217.901ZM1219.15 177.394V159.592C1219.15 157.067 1219.05 156.96 1216.57 156.96H1181.12C1180.65 156.96 1180.14 157.019 1179.72 156.96C1178.26 156.96 1177.77 157.662 1177.77 159.076C1177.81 171.255 1177.81 183.429 1177.77 195.596C1177.77 197.136 1178.41 197.789 1179.86 197.76C1181.66 197.76 1183.46 197.623 1185.26 197.623C1195.9 197.623 1206.53 197.623 1217.16 197.623C1219.11 197.623 1219.11 197.623 1219.11 195.615C1219.11 189.532 1219.11 183.445 1219.11 177.355" fill="#17181c"></path>
              <path d="M52.9678 99.3528C52.9678 107.503 58.2908 112.095 90.0142 117.778H90.0337C153.305 129.136 165.979 148.166 165.979 175.2C165.979 191.725 158.014 230.185 84.272 230.185C56.4483 230.185 8.5902 222.941 0.430245 174.459L0.0402832 172.139H44.9541L45.4026 173.504C50.6476 189.288 63.8185 196.327 88.1132 196.327C116.707 196.327 120.012 186.655 120.012 179.383C120.012 169.292 113.548 163.073 78.2374 157.077C15.8337 146.402 7.23508 124.934 7.23508 103.33C7.23508 71.1293 36.4627 50.3151 81.708 50.3151C149.142 50.3151 158.228 89.5745 159.427 101.605L159.642 103.789H114.855L114.436 102.346C111.881 93.3669 105.837 84.2027 80.4407 84.2027C67.9034 84.2027 52.9678 86.8252 52.9678 99.3528Z" fill="#17181c"></path>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M500.332 228.927H551.115L484.841 52.411H425.732L359.176 228.927H408.808L422.291 189.083H487.132L500.332 228.927ZM454.716 86.3864L477.958 157.759H431.474L454.716 86.3864Z" fill="#17181c"></path>
              <path d="M622.556 193.353H717.521V228.927H573.206V52.411H622.556V193.353Z" fill="#17181c"></path>
              <path d="M740.578 52.411V228.927H887.779V193.353H789.918V157.252H881.705V123.813H789.918V87.9755H888.042V52.411H740.578Z" fill="#17181c"></path>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M1001.27 52.411C1023.84 52.411 1041.39 57.357 1053.91 67.2491C1066.44 77.1411 1072.7 90.2926 1072.7 106.703C1072.7 124.713 1066.48 138.443 1054.05 147.893C1048.56 152.064 1042.09 155.315 1034.62 157.645L1083.96 228.927H1029.44L989.014 164.476H959.405V228.927H910.913V52.411H1001.27ZM994.443 131.846C1004 131.846 1011.18 130.062 1015.96 126.494C1020.74 122.926 1023.13 117.219 1023.13 109.375C1023.13 101.712 1020.74 96.0965 1015.96 92.5283C1011.18 88.9602 1004 87.1761 994.443 87.1761H959.444V131.846H994.443Z" fill="#17181c"></path>
              <path d="M223.079 141.04C223.079 170.55 243.542 190.808 270.294 190.808C289.967 190.808 305.117 177.647 311.415 157.174H353.706C346.434 208.513 313.024 229.171 270.294 229.171C216.196 229.171 179.013 193.168 179.013 141.04C179.013 88.7067 216.196 52.8985 270.294 52.8985C303.284 52.8985 336.704 65.504 349.505 102.755L309.826 116.199C302.787 99.0602 288.485 91.261 270.294 91.261C243.542 91.261 223.079 111.529 223.079 141.04Z" fill="#17181c"></path>
            </svg>
          </a>
          <h2>Admin Login</h2>
          <p>Sign in with your @scaler.com email</p>
        </div>
        
        <div className="login-form">
          {error && <div className="error-message">👉 {error}</div>}
          {message && <div className="success-message">💡 {message}</div>}
          
          <form onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label htmlFor="email">Work Email</label>
              <input 
                id="email"
                type="email" 
                className="dark-input" 
                placeholder="name@scaler.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
              />
            </div>
            
            <button 
              type="submit" 
              className="primary-login-btn" 
              disabled={isLoading}
            >
              {isLoading ? <div className="loading-spinner"></div> : 'Send Magic Link'}
            </button>
          </form>
        </div>
        
        <div className="login-footer">
          <a href="/">← Back to Support Center</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
