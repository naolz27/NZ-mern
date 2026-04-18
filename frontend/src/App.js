import React, { useState, useEffect } from 'react';
import axios from 'axios';
import emailjs from '@emailjs/browser';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [currentSection, setCurrentSection] = useState('home');
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
    checkUserSession();
    handlePaymentCallback();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = () => {
    setCategories([
      {id: 1, name: 'Electronics'},
      {id: 2, name: 'Clothing'},
      {id: 3, name: 'Home'}
    ]);
  };

  const checkUserSession = () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  };

  const handlePaymentCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const tx_ref = urlParams.get('tx_ref');

    if (status === 'success' && tx_ref) {
      setPaymentSuccess({ tx_ref, status: 'success' });
      setCart([]);
      setCurrentSection('orders');
      loadProducts();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (status === 'cancelled') {
      alert('❌ Payment Cancelled\n\nYour payment was cancelled.\nYour cart items are still saved.');
      setCurrentSection('cart');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email, password
      });
      if (response.data.success) {
        setCurrentUser(response.data.user);
        localStorage.setItem('currentUser', JSON.stringify(response.data.user));
        
        // Role-based redirection after login
        if (response.data.user.role === 'admin') {
          setCurrentSection('admin');
        } else if (response.data.user.role === 'seller') {
          setCurrentSection('seller');
        } else {
          setCurrentSection('home');
        }
        
        alert(`Login successful! Welcome ${response.data.user.role}!`);
      } else {
        alert(response.data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(error.response?.data?.message || 'Login failed');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setCurrentSection('home');
  };

  const addToCart = (product) => {
   if (!currentUser) {
     if (confirm('You need to login to add items to cart.\n\nClick OK to login or Cancel to register.')) {
       setCurrentSection('login');
     } else {
       setCurrentSection('register');
     }
     return;
   }

   const existingItem = cart.find(item => item.id === product.id);
   const currentQuantity = existingItem ? existingItem.quantity : 0;
   if (currentQuantity + 1 > product.stock) {
     alert(`Cannot add more items. Only ${product.stock} available in stock.`);
     return;
   }

   if (existingItem) {
     setCart(cart.map(item =>
       item.id === product.id
         ? {...item, quantity: item.quantity + 1}
         : item
     ));
   } else {
     setCart([...cart, {...product, quantity: 1}]);
   }
   alert('Item added to cart!');
 };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, change) => {
   setCart(prevCart =>
     prevCart.map(item => {
       if (item && item.id === productId) {
         const newQuantity = (item.quantity || 0) + change;
         if (newQuantity <= 0) return null;
         if (newQuantity > item.stock) {
           alert(`Cannot increase quantity. Only ${item.stock} available in stock.`);
           return item;
         }
         return {...item, quantity: newQuantity};
       }
       return item;
     }).filter(item => item !== null)
   );
 };

  return (
    <div className="App">
      <Header 
        currentUser={currentUser} 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        setCurrentSection={setCurrentSection}
        logout={logout}
      />
      
      {currentSection === 'home' && <Home categories={categories} setCurrentSection={setCurrentSection} />}
      {currentSection === 'products' && 
        <Products products={products} addToCart={addToCart} />}
      {currentSection === 'cart' && 
        <Cart cart={cart} removeFromCart={removeFromCart} updateQuantity={updateQuantity} setCurrentSection={setCurrentSection} />}
      {currentSection === 'checkout' && 
        <Checkout cart={cart} setCart={setCart} currentUser={currentUser} loadProducts={loadProducts} setCurrentSection={setCurrentSection} />}
      {currentSection === 'orders' && currentUser && 
        <OrderHistory currentUser={currentUser} />}
      {currentSection === 'profile' && currentUser && 
        <UserProfile currentUser={currentUser} setCurrentUser={setCurrentUser} />}
      {currentSection === 'login' && <Login onLogin={login} setCurrentSection={setCurrentSection} />}
      {currentSection === 'register' && <Register />}
      {currentSection === 'forgot-password' && <ForgotPassword setCurrentSection={setCurrentSection} />}
      {currentSection === 'admin' && currentUser?.role === 'admin' &&
        <Admin currentUser={currentUser} products={products} loadProducts={loadProducts} />}
      {currentSection === 'seller' && currentUser?.role === 'seller' &&
        <Seller currentUser={currentUser} products={products} loadProducts={loadProducts} />}

      {paymentSuccess && <PaymentSuccessModal paymentSuccess={paymentSuccess} onClose={() => setPaymentSuccess(null)} />}
    </div>
  );
}

// Header with role-based navigation
const Header = ({ currentUser, cartCount, setCurrentSection, logout }) => (
  <header className="header">
    <div className="container">
      <div className="logo">
        <h1><i className="fas fa-store"></i> EcoStore</h1>
      </div>
      <nav className="nav">
        {(!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'seller')) && (
          <>
            <a href="#" onClick={() => setCurrentSection('home')}>Home</a>
            <a href="#" onClick={() => setCurrentSection('products')}>Products</a>
            <a href="#" onClick={() => setCurrentSection('cart')}>Cart ({cartCount})</a>
          </>
        )}
        {currentUser ? (
          <>
            {/* Admin Navigation */}
            {currentUser.role === 'admin' && 
              <a href="#" onClick={() => setCurrentSection('admin')}>Admin Dashboard</a>}
            
            {/* Seller Navigation */}
            {currentUser.role === 'seller' && 
              <a href="#" onClick={() => setCurrentSection('seller')}>Seller Dashboard</a>}
            
            {/* Customer Navigation */}
            {currentUser.role === 'customer' && (
              <>
                <a href="#" onClick={() => setCurrentSection('orders')}>My Orders</a>
                <a href="#" onClick={() => setCurrentSection('profile')}>My Profile</a>
              </>
            )}
            
            {/* Common for all logged in users */}
            <span style={{color: '#fff', fontSize: '0.9em'}}>
              ({currentUser.role}: {currentUser.name})
            </span>
            <a href="#" onClick={logout}>Logout</a>
          </>
        ) : (
          <>
            <a href="#" onClick={() => setCurrentSection('login')}>Login</a>
            <a href="#" onClick={() => setCurrentSection('register')}>Register</a>
          </>
        )}
      </nav>
    </div>
  </header>
);

const Home = ({ categories, setCurrentSection }) => (
  <section className="section active">
    <div className="hero">
      <h2>Welcome to EcoStore</h2>
      <p>Your one-stop shop with MERN Stack</p>
      <button onClick={() => setCurrentSection('products')} className="btn-primary">Shop Now</button>
    </div>
    <div className="container">
      <div className="categories">
        {categories.map(category => (
          <div key={category.id} className="category" onClick={() => setCurrentSection('products')}>
            <i className={`fas fa-${getCategoryIcon(category.name)}`}></i>
            <h3>{category.name}</h3>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Products = ({ products, addToCart }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState('all');

  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' || 
                          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
                            product.category_id === parseInt(selectedCategory);
    
    const matchesPrice = priceRange === 'all' || 
                         (priceRange === 'under50' && parseFloat(product.price) < 50) ||
                         (priceRange === '50to200' && parseFloat(product.price) >= 50 && parseFloat(product.price) <= 200) ||
                         (priceRange === 'over200' && parseFloat(product.price) > 200);
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  return (
    <section className="section active">
      <div className="container">
        <div className="products-header">
          <h2>Products</h2>
          
          <div className="filters">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              <option value="1">Electronics</option>
              <option value="2">Clothing</option>
              <option value="3">Home</option>
            </select>
            
            <select 
              value={priceRange} 
              onChange={(e) => setPriceRange(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Prices</option>
              <option value="under50">Under 50 ETB</option>
              <option value="50to200">50 - 200 ETB</option>
              <option value="over200">Over 200 ETB</option>
            </select>
          </div>
        </div>
        
        <div className="products-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <img src={product.image_url} alt={product.name} className="product-image" />
              <div className="product-info">
                <div className="product-name">{product.name}</div>
                <div className="product-price">{parseFloat(product.price).toFixed(2)} ETB</div>
                <div className="product-description">{product.description}</div>
                <div className={`stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                  {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
                </div>
                <p style={{ fontSize: '0.9em', color: '#666', margin: '5px 0' }}>
                  Stored by: {product.seller_name || 'EcoStore'}
                </p>
                <button
                  onClick={() => addToCart(product)}
                  className="btn-primary"
                  disabled={product.stock === 0}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Register with role selection
const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'customer'
  });
  const [passwordStrength, setPasswordStrength] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    if (name === 'password') {
      checkPasswordStrength(value);
    }
  };

  const checkPasswordStrength = (password) => {
    if (password.length < 6) {
      setPasswordStrength('weak');
    } else if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setPasswordStrength('medium');
    } else {
      setPasswordStrength('strong');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    if (passwordStrength === 'weak') {
      alert('Password is too weak. Use at least 6 characters.');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/auth/register`, {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });
      
      if (response.data.success) {
        alert(`Registration successful as ${formData.role}! Please login.`);
        window.location.reload();
      } else {
        alert(response.data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    }
  };

  return (
    <section className="section active">
      <div className="auth-container">
        <div className="auth-form">
          <h2>Register</h2>
          <form onSubmit={handleSubmit}>
            <input 
              type="text" 
              name="fullName"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={handleInputChange}
              required 
            />
            <input 
              type="email" 
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              required 
            />
            <input 
              type="password" 
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required 
            />
            {formData.password && (
              <div className={`password-strength ${passwordStrength}`}>
                Password strength: {passwordStrength}
              </div>
            )}
            <input 
              type="password" 
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required 
            />
            
            {/* Role Selection */}
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '0.8rem',
                marginBottom: '1rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="customer">Register as Customer</option>
              <option value="seller">Register as Seller</option>
            </select>
            
            <button type="submit" className="btn-primary">Register</button>
          </form>
        </div>
      </div>
    </section>
  );
};

const Login = ({ onLogin, setCurrentSection }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <section className="section active">
      <div className="auth-container">
        <div className="auth-form">
          <h2>Login</h2>
          <form onSubmit={handleSubmit}>
            <input 
              type="email" 
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
            <input 
              type="password" 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <button type="submit" className="btn-primary">Login</button>
          </form>
          <p style={{textAlign: 'center', marginTop: '10px'}}>
            <a href="#" onClick={() => setCurrentSection('forgot-password')} style={{color: '#2196F3'}}>Forgot Password?</a>
          </p>
        </div>
      </div>
    </section>
  );
};

// Seller Dashboard Component
const Seller = ({ currentUser, products, loadProducts }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [sellerProducts, setSellerProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [earnings, setEarnings] = useState({ total_sales: '0.00', commission: '0.00', net_earnings: '0.00' });
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', stock: '', category_id: '1', image_url: ''
  });
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    if (activeTab === 'products') loadSellerProducts();
    if (activeTab === 'orders') loadSellerOrders();
    if (activeTab === 'earnings') loadSellerEarnings();
  }, [activeTab]);

  const loadSellerProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/seller/products/${currentUser._id}`);
      setSellerProducts(response.data);
    } catch (error) {
      console.error('Error loading seller products:', error);
    }
  };

  const loadSellerOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE}/seller/orders/${currentUser._id}`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading seller orders:', error);
    }
  };

  const loadSellerEarnings = async () => {
    try {
      const response = await axios.get(`${API_BASE}/seller/earnings/${currentUser._id}`);
      setEarnings(response.data);
    } catch (error) {
      console.error('Error loading seller earnings:', error);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = { ...productForm, seller_id: currentUser._id };
      
      if (editingProduct) {
        await axios.put(`${API_BASE}/seller/products/${editingProduct._id}`, productData);
        alert('Product updated successfully!');
      } else {
        await axios.post(`${API_BASE}/seller/products`, productData);
        alert('Product added successfully!');
      }
      
      setProductForm({ name: '', description: '', price: '', stock: '', category_id: '1', image_url: '' });
      setEditingProduct(null);
      loadSellerProducts();
      loadProducts(); // Refresh main products list
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product');
    }
  };

  const editProduct = (product) => {
    setProductForm(product);
    setEditingProduct(product);
  };

  const deleteProduct = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`${API_BASE}/seller/products/${productId}`, {
          data: { seller_id: currentUser._id }
        });
        alert('Product deleted successfully!');
        loadSellerProducts();
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product');
      }
    }
  };

  const updateStock = async (product) => {
    const newStock = prompt('Enter new stock quantity:', product.stock);
    if (newStock !== null && !isNaN(newStock)) {
      try {
        await axios.put(`${API_BASE}/seller/products/${product._id}`, {
          ...product,
          stock: Number(newStock),
          seller_id: currentUser._id
        });
        alert('Stock updated successfully!');
        loadSellerProducts();
        loadProducts();
      } catch (error) {
        console.error('Error updating stock:', error);
        alert('Error updating stock');
      }
    }
  };

  return (
    <section className="section active">
      <div className="container">
        <h2>Seller Dashboard - {currentUser.name}</h2>
        
        <div className="admin-tabs">
          <button
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            My Products
          </button>
          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            My Orders
          </button>
          <button
            className={`tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            My Earnings
          </button>
        </div>

        <div className="admin-content">
          {activeTab === 'products' && (
            <>
              <div className="admin-header">
                <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              </div>
              
              <div className="product-form">
                <form onSubmit={handleProductSubmit}>
                  <input
                    type="text"
                    placeholder="Product Name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    required
                  />
                  <textarea
                    placeholder="Description"
                    value={productForm.description}
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={productForm.price}
                    onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Stock"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                    required
                  />
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({...productForm, category_id: e.target.value})}
                    required
                  >
                    <option value="1">Electronics</option>
                    <option value="2">Clothing</option>
                    <option value="3">Home</option>
                  </select>
                  <input
                    type="url"
                    placeholder="Image URL"
                    value={productForm.image_url}
                    onChange={(e) => setProductForm({...productForm, image_url: e.target.value})}
                    required
                  />
                  <div className="form-buttons">
                    <button type="submit" className="btn-primary">
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </button>
                    {editingProduct && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingProduct(null);
                          setProductForm({ name: '', description: '', price: '', stock: '', category_id: '1', image_url: '' });
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <h3>My Products ({sellerProducts.length})</h3>
              <div className="products-grid">
                {sellerProducts.map(product => (
                  <div key={product._id} className="product-card">
                    <img src={product.image_url} alt={product.name} className="product-image" />
                    <div className="product-info">
                      <div className="product-name">{product.name}</div>
                      <div className="product-price">{parseFloat(product.price).toFixed(2)} ETB</div>
                      <div className="product-description">{product.description}</div>
                      <p>Stock: {product.stock}</p>
                      <p style={{
                        fontSize: '0.9em',
                        fontWeight: 'bold',
                        color: product.status === 'approved' ? 'green' :
                               product.status === 'pending' ? 'orange' :
                               product.status === 'rejected' ? 'red' : 'black'
                      }}>
                        Status: {product.status || 'pending'}
                      </p>
                      <div className="form-buttons">
                        <button onClick={() => editProduct(product)} className="btn-secondary">Edit</button>
                        <button onClick={() => updateStock(product)} className="btn-primary">Update Stock</button>
                        <button onClick={() => deleteProduct(product._id)} className="btn-danger">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <div className="orders-table">
              <h3>Orders for My Products</h3>
              {orders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <h4>Order #{order.id}</h4>
                    <span className={`order-status ${order.status}`}>{order.status}</span>
                  </div>
                  <div className="order-details">
                    <p><strong>Customer:</strong> {order.customer_name} ({order.customer_email})</p>
                    <p><strong>Total:</strong> {parseFloat(order.total).toFixed(2)} ETB</p>
                    <p><strong>Items:</strong> {order.items}</p>
                    <p><strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="earnings-section">
              <h3>My Earnings Overview</h3>
              <div className="earnings-cards">
                <div className="earnings-card">
                  <h4>Total Sales</h4>
                  <div className="earnings-amount">{earnings.total_sales} ETB</div>
                  <div className="earnings-label">All completed sales</div>
                </div>
                <div className="earnings-card commission">
                  <h4>Platform Commission (5%)</h4>
                  <div className="earnings-amount">{earnings.commission} ETB</div>
                  <div className="earnings-label">EcoStore platform fee</div>
                </div>
                <div className="earnings-card net">
                  <h4>Net Earnings</h4>
                  <div className="earnings-amount">{earnings.net_earnings} ETB</div>
                  <div className="earnings-label">Amount you receive</div>
                </div>
              </div>
              <div className="earnings-info">
                <p><strong>How Commission Works:</strong></p>
                <ul>
                  <li>EcoStore takes 5% commission from each sale</li>
                  <li>You receive 95% of the total sale amount</li>
                  <li>Only completed orders are included in calculations</li>
                  <li>Cancelled orders are excluded from earnings</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const Cart = ({ cart, removeFromCart, updateQuantity, setCurrentSection }) => {
  const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

  if (cart.length === 0) {
    return (
      <section className="section active">
        <div className="container">
          <h2>Your Cart</h2>
          <div className="empty-cart">
            <p>Your cart is empty</p>
            <button onClick={() => setCurrentSection('products')} className="btn-primary">
              Continue Shopping
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section active">
      <div className="container">
        <h2>Your Cart</h2>
        <div className="cart-items">
          {cart.map(item => (
            <div key={item.id} className="cart-item">
              <img src={item.image_url} alt={item.name} className="cart-item-image" />
              <div className="cart-item-info">
                <h3>{item.name}</h3>
                <p className="cart-item-price">{parseFloat(item.price).toFixed(2)} ETB</p>
                <div className="quantity-controls">
                  <button onClick={() => updateQuantity(item.id, -1)} className="quantity-btn">-</button>
                  <span className="quantity">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="quantity-btn">+</button>
                </div>
                <p className="item-total">
                  Subtotal: {(parseFloat(item.price) * item.quantity).toFixed(2)} ETB
                </p>
              </div>
              <div className="cart-item-controls">
                <button onClick={() => removeFromCart(item.id)} className="btn-danger">Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="cart-summary">
          <h3>Total: {total.toFixed(2)} ETB</h3>
          <button onClick={() => setCurrentSection('checkout')} className="btn-primary">
            Proceed to Checkout
          </button>
        </div>
      </div>
    </section>
  );
};

const Checkout = ({ cart, setCart, currentUser, loadProducts, setCurrentSection }) => {
  const [paymentMethod, setPaymentMethod] = useState('chapa');
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    country: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://api.chapa.co/v1/inline.js';
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShippingInfo({ ...shippingInfo, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Check stock availability
    for (const item of cart) {
      if (item.quantity > item.stock) {
        alert(`Insufficient stock for ${item.name}. Available: ${item.stock}, Requested: ${item.quantity}`);
        setIsProcessing(false);
        return;
      }
    }

    try {
      const shippingAddress = `${shippingInfo.name}, ${shippingInfo.phone}, ${shippingInfo.street}, ${shippingInfo.city}, ${shippingInfo.country}`;

      if (paymentMethod === 'chapa') {
        const tx_ref = `ecostore-${Date.now()}`;
        const orderData = {
          user_id: currentUser._id,
          total: total,
          payment_method: 'card',
          status: 'pending',
          shipping_address: shippingAddress,
          tx_ref: tx_ref,
          items: cart.map(item => ({
            product_id: item._id,
            quantity: item.quantity,
            price: item.price
          }))
        };

        const orderResponse = await axios.post(`${API_BASE}/orders`, orderData);

        if (orderResponse.data.success) {
          if (!window.ChapaCheckout) {
            alert('Payment service is not available. Please try again later.');
            setIsProcessing(false);
            return;
          }
          const chapa = new window.ChapaCheckout({
            publicKey: 'CHAPUBK_TEST-TDeUDP7E04YfxOe9JwLOeB4NnywmEBuu',
            amount: total.toString(),
            currency: 'ETB',
            availablePaymentMethods: ['telebirr', 'cbebirr', 'ebirr', 'mpesa', 'chapa'],
            customizations: {
              buttonText: 'Pay Now',
              styles: '.chapa-pay-button { background-color: #4CAF50; color: white; }'
            },
            callbackUrl: `${window.location.origin}/api/payment/callback`,
            returnUrl: `${window.location.origin}/?status=success&tx_ref=${tx_ref}`,
          });
          chapa.initialize('chapa-inline-form');
        } else {
          alert('Order creation failed.');
        }
        setIsProcessing(false);
      } else {
        // For COD, create order directly
        const orderData = {
          user_id: currentUser._id,
          total: total,
          payment_method: 'cod',
          shipping_address: shippingAddress,
          items: cart.map(item => ({
            product_id: item._id || item.id,
            quantity: item.quantity,
            price: item.price
          }))
        };

        const response = await axios.post(`${API_BASE}/orders`, orderData);
        
        if (response.data.success) {
          alert('✅ Order placed successfully! You will pay on delivery.');
          setCart([]);
          loadProducts();
          setCurrentSection('orders');
        } else {
          alert('Order failed. Please try again.');
        }
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Order failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <section className="section active">
      <div className="container">
        <h2>Checkout</h2>
        <div className="checkout-container">
          <div className="checkout-left">
            <form onSubmit={handleSubmit}>
              <div className="shipping-info">
                <h3>Shipping Information</h3>
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={shippingInfo.name}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number"
                  value={shippingInfo.phone}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="street"
                  placeholder="Street Address"
                  value={shippingInfo.street}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  value={shippingInfo.city}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="country"
                  placeholder="Country"
                  value={shippingInfo.country}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="payment-methods">
                <h3>Payment Method</h3>
                <div className="payment-option">
                  <input
                    type="radio"
                    id="chapa"
                    name="payment"
                    value="chapa"
                    checked={paymentMethod === 'chapa'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <label htmlFor="chapa">Chapa Payment</label>
                </div>
                <div className="payment-option">
                  <input
                    type="radio"
                    id="cod"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <label htmlFor="cod">Cash on Delivery</label>
                </div>
              </div>

              {paymentMethod === 'chapa' && <div id="chapa-inline-form"></div>}
              
              <button type="submit" className="btn-primary checkout-btn" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Place Order'}
              </button>
            </form>
          </div>
          
          <div className="checkout-right">
            <div className="order-summary">
              <h3>Order Summary</h3>
              {cart.map(item => (
                <div key={item.id} className="checkout-item">
                  <span>{item.name} x {item.quantity}</span>
                  <span>{(parseFloat(item.price) * item.quantity).toFixed(2)} ETB</span>
                </div>
              ))}
              <div className="checkout-total">
                <strong>Total: {total.toFixed(2)} ETB</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const OrderHistory = ({ currentUser }) => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE}/orders/${currentUser._id}`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const markAsDelivered = async (orderId) => {
    try {
      await axios.put(`${API_BASE}/orders/${orderId}/status`, { status: 'delivered', userId: currentUser._id });
      alert('Order marked as delivered!');
      loadOrders(); // Refresh the list
    } catch (error) {
      console.error('Error updating order status:', error);
      alert(error.response?.data?.message || 'Failed to update order status');
    }
  };

  const generateInvoice = (order) => {
    const invoiceHTML = `
      <html>
        <head>
          <title>EcoStore Invoice - Order #${order.id}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f9f9f9;
              color: #333;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #4CAF50;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #4CAF50;
              margin: 0;
              font-size: 2.5em;
            }
            .header p {
              margin: 5px 0;
              color: #666;
              font-size: 1.1em;
            }
            .invoice-details {
              margin: 20px 0;
            }
            .order-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .order-info p {
              margin: 8px 0;
              font-size: 1em;
            }
            .items-section h3 {
              color: #4CAF50;
              border-bottom: 2px solid #4CAF50;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .items-list {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              font-family: monospace;
              white-space: pre-line;
            }
            .total {
              font-weight: bold;
              font-size: 1.5em;
              color: #4CAF50;
              text-align: center;
              margin: 30px 0;
              padding: 15px;
              background: #e8f5e8;
              border-radius: 8px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              border-top: 2px solid #eee;
              padding-top: 20px;
            }
            .footer p {
              margin: 10px 0;
              color: #666;
            }
            .status {
              display: inline-block;
              padding: 5px 15px;
              border-radius: 20px;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 0.9em;
            }
            .status.pending { background: #fff3cd; color: #856404; }
            .status.processing { background: #cce5ff; color: #004085; }
            .status.shipped { background: #d1ecf1; color: #0c5460; }
            .status.delivered { background: #d4edda; color: #155724; }
            .status.cancelled { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛒 EcoStore</h1>
              <p>Invoice for Order #${order.id}</p>
              <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div class="invoice-details">
              <div class="order-info">
                <p><strong>👤 Customer:</strong> ${currentUser.name}</p>
                <p><strong>📧 Email:</strong> ${currentUser.email}</p>
                <p><strong>📍 Shipping Address:</strong> ${order.shipping_address}</p>
                <p><strong>💳 Payment Method:</strong> ${order.payment_method === 'card' ? 'Chapa Payment' : 'Cash on Delivery'}</p>
              </div>
              <div class="items-section">
                <h3>📦 Items Ordered</h3>
                <div class="items-list">${order.items}</div>
              </div>
              <div class="total">
                💰 Total Amount: ${parseFloat(order.total).toFixed(2)} ETB
              </div>
            </div>
            <div class="footer">
              <p>Thank you for shopping with EcoStore! 🌟</p>
              <p>Order Status: <span class="status ${order.status}">${order.status}</span></p>
            </div>
          </div>
        </body>
      </html>
    `;

    const newWindow = window.open('', '_blank');
    newWindow.document.write(invoiceHTML);
    newWindow.document.close();
    newWindow.print();
  };

  return (
    <section className="section active">
      <div className="container">
        <h2>My Orders</h2>
        {orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <h3>Order #{order.id}</h3>
                  <span className={`order-status ${order.status}`}>{order.status}</span>
                </div>
                <div className="order-details">
                  <p><strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                  <p><strong>Total:</strong> {parseFloat(order.total).toFixed(2)} ETB</p>
                  <p><strong>Payment:</strong> {order.payment_method}</p>
                  <p><strong>Items:</strong> {order.items}</p>
                  <p><strong>Address:</strong> {order.shipping_address}</p>
                  {order.status === 'shipped' && (
                    <button
                      onClick={() => markAsDelivered(order.id)}
                      style={{
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginTop: '10px',
                        marginRight: '10px'
                      }}
                    >
                      Mark as Delivered
                    </button>
                  )}
                  <button
                    onClick={() => generateInvoice(order)}
                    style={{
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    📄 Download Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const UserProfile = ({ currentUser, setCurrentUser }) => {
  const [formData, setFormData] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    try {
      const updateData = {
        userId: currentUser._id,
        name: formData.name,
        email: formData.email
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await axios.put(`${API_BASE}/auth/profile`, updateData);
      
      if (response.data.success) {
        alert('Profile updated successfully!');
        const updatedUser = { ...currentUser, name: formData.name, email: formData.email };
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        alert(response.data.message || 'Profile update failed');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Profile update failed. Please try again.');
    }
  };

  return (
    <section className="section active">
      <div className="container">
        <div className="profile-container">
          <div className="profile-info">
            <div className="profile-header">
              <div className="profile-avatar">
                <i className="fas fa-user-circle"></i>
              </div>
              <div className="profile-details">
                <h3>{currentUser.name}</h3>
                <p>{currentUser.email}</p>
                <span className="user-role">{currentUser.role}</span>
              </div>
            </div>
            
            <div className="profile-edit">
              <h4>Edit Profile</h4>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <h4>Change Password (Optional)</h4>
                
                <div className="form-group">
                  <label>Current Password:</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>New Password:</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>Confirm New Password:</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>
                
                <button type="submit" className="btn-primary">Update Profile</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Admin = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesReport, setSalesReport] = useState({ summary: {}, daily_data: [] });
  const [pendingProducts, setPendingProducts] = useState([]);
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', stock: '', category_id: '1', image_url: ''
  });
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'admin'
  });
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'sellers') loadPendingProducts();
    if (activeTab === 'products') loadProducts();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'sales') loadSalesReport();
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadProducts = async () => {
   try {
     const response = await axios.get(`${API_BASE}/products`);
     setProducts(response.data.map(product => ({ ...product, id: product._id })));
   } catch (error) {
     console.error('Error loading products:', error);
   }
 };

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE}/admin/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadSalesReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/admin/sales-report`);
      setSalesReport(response.data);
    } catch (error) {
      console.error('Error loading sales report:', error);
    }
  };

  const loadPendingProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/admin/pending-products`);
      setPendingProducts(response.data);
    } catch (error) {
      console.error('Error loading pending products:', error);
    }
  };


  const deleteProduct = async (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`${API_BASE}/admin/products/${productId}`);
        loadProducts();
        alert('Product deleted successfully!');
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product');
      }
    }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await axios.put(`${API_BASE}/admin/users/${userId}/role`, { role });
      loadUsers();
      alert('User role updated successfully!');
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role');
    }
  };

  const deleteUser = async (userId) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`${API_BASE}/admin/users/${userId}`);
        loadUsers();
        alert('User deleted successfully!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
      }
    }
  };

  const approveProduct = async (productId) => {
    try {
      await axios.put(`${API_BASE}/admin/products/${productId}/status`, { status: 'approved' });
      loadPendingProducts();
      alert('Product approved successfully!');
    } catch (error) {
      console.error('Error approving product:', error);
      alert('Failed to approve product');
    }
  };

  const rejectProduct = async (productId) => {
    if (confirm('Are you sure you want to reject this product?')) {
      try {
        await axios.put(`${API_BASE}/admin/products/${productId}/status`, { status: 'rejected' });
        loadPendingProducts();
        alert('Product rejected!');
      } catch (error) {
        console.error('Error rejecting product:', error);
        alert('Failed to reject product');
      }
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await axios.put(`${API_BASE}/admin/products/${editingProduct.id}`, productForm);
        alert('Product updated successfully!');
      } else {
        await axios.post(`${API_BASE}/admin/products`, productForm);
        alert('Product added successfully!');
      }
      setProductForm({ name: '', description: '', price: '', stock: '', category_id: '1', image_url: '' });
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product');
    }
  };

  const editProduct = (product) => {
    setProductForm(product);
    setEditingProduct(product);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE}/admin/users`, userForm);
      if (response.data.success) {
        alert('User created successfully!');
        setUserForm({ name: '', email: '', password: '', role: 'customer' });
        loadUsers();
      } else {
        alert(response.data.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API_BASE}/admin/orders/${orderId}/status`, { status });
      loadOrders();
      alert('Order status updated successfully!');
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };


  return (
    <section className="section active">
      <div className="container">
        <h2>Admin Dashboard - {currentUser.name}</h2>

        <div className="admin-tabs">
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`tab-btn ${activeTab === 'sellers' ? 'active' : ''}`}
            onClick={() => setActiveTab('sellers')}
          >
            Seller Products
          </button>
          <button
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </button>
          <button
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders
          </button>
          <button
            className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            Sales Report
          </button>
        </div>

        <div className="admin-content">
          {activeTab === 'users' && (
            <div>
              <h3>Add New User</h3>
              <form onSubmit={handleUserSubmit} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={userForm.name}
                  onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                >
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                  Create User
                </button>
              </form>

              <h3>All Users ({users.length})</h3>
              <div className="users-table">
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Role</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Registered</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.id}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.name}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.email}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          style={{ padding: '4px' }}
                        >
                          <option value="customer">Customer</option>
                          <option value="seller">Seller</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                        <button
                          onClick={() => deleteUser(user.id)}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {activeTab === 'sellers' && (
            <div>
              <h3>Seller Products</h3>
              <div className="products-grid">
                {pendingProducts.map(product => (
                  <div key={product._id} className="product-card">
                    <img src={product.image_url} alt={product.name} className="product-image" />
                    <div className="product-info">
                      <div className="product-name">{product.name}</div>
                      <div className="product-price">{parseFloat(product.price).toFixed(2)} ETB</div>
                      <div className="product-description">{product.description}</div>
                      <p style={{ fontSize: '0.9em', color: '#666', margin: '5px 0' }}>
                        Seller: {product.seller_name}
                      </p>
                      <div className="form-buttons">
                        <button
                          onClick={() => approveProduct(product._id)}
                          style={{ background: '#28a745', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectProduct(product._id)}
                          style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingProducts.length === 0 && <p>No pending products</p>}
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <form onSubmit={handleProductSubmit} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <input
                  type="text"
                  placeholder="Product Name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <textarea
                  placeholder="Description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px', minHeight: '80px' }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={productForm.price}
                  onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={productForm.stock}
                  onChange={(e) => setProductForm({...productForm, stock: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <select
                  value={productForm.category_id}
                  onChange={(e) => setProductForm({...productForm, category_id: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                >
                  <option value="1">Electronics</option>
                  <option value="2">Clothing</option>
                  <option value="3">Home</option>
                </select>
                <input
                  type="url"
                  placeholder="Image URL"
                  value={productForm.image_url}
                  onChange={(e) => setProductForm({...productForm, image_url: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                    {editingProduct ? 'Update Product' : 'Add Product'}
                  </button>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setProductForm({ name: '', description: '', price: '', stock: '', category_id: '1', image_url: '' });
                      }}
                      style={{ background: '#6c757d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <h3>All Products ({products.length})</h3>
              <div className="products-grid">
                {products.map(product => (
                  <div key={product._id} className="product-card">
                    <img src={product.image_url} alt={product.name} className="product-image" />
                    <div className="product-info">
                      <div className="product-name">{product.name}</div>
                      <div className="product-price">{parseFloat(product.price).toFixed(2)} ETB</div>
                      <div className="product-description">{product.description}</div>
                      <div className={`stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                        {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
                      </div>
                      <p>Seller: {product.seller_id || 'Admin'}</p>
                      <p>Status: <span style={{
                        color: product.status === 'approved' ? 'green' : product.status === 'pending' ? 'orange' : 'red'
                      }}>{product.status || 'approved'}</span></p>
                      <div className="form-buttons">
                        <button
                          onClick={() => editProduct(product)}
                          style={{ background: '#ffc107', color: 'black', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteProduct(product._id)}
                          style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {activeTab === 'orders' && (
            <div className="orders-table">
              <h3>Orders ({orders.length})</h3>
              {orders.map(order => (
                <div key={order._id} className="order-card">
                  <div className="order-header">
                    <h4>Order #{order._id}</h4>
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                      style={{ padding: '5px', marginLeft: '10px' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="order-details">
                    <p><strong>Customer:</strong> {order.customer_name} ({order.customer_email})</p>
                    <p><strong>Total:</strong> {parseFloat(order.total).toFixed(2)} ETB</p>
                    <p><strong>Payment:</strong> {order.payment_method}</p>
                    <p><strong>Items:</strong> {order.items}</p>
                    <p><strong>Date:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="sales-report">
              <h3>Sales Report</h3>
              <div className="sales-summary">
                <div className="summary-card">
                  <h4>Total Orders</h4>
                  <p>{salesReport.summary.total_orders || 0}</p>
                </div>
                <div className="summary-card">
                  <h4>Total Revenue</h4>
                  <p>{parseFloat(salesReport.summary.total_revenue || 0).toFixed(2)} ETB</p>
                </div>
              </div>
              <h4>Daily Sales (Last 30 Days)</h4>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {salesReport.daily_data.map(day => (
                    <tr key={day.order_date}>
                      <td>{new Date(day.order_date).toLocaleDateString()}</td>
                      <td>{day.total_orders}</td>
                      <td>{parseFloat(day.total_revenue).toFixed(2)} ETB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const PaymentSuccessModal = ({ paymentSuccess, onClose }) => {
  // Auto-close the modal after 3 seconds and redirect to orders
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4em', marginBottom: '20px' }}>🎉</div>
        <h2 style={{ color: '#4CAF50', marginBottom: '20px' }}>Payment Completed!</h2>
        <p style={{ marginBottom: '20px' }}>Your order has been confirmed and is being processed.</p>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          Redirecting to your orders...
        </p>
      </div>
    </div>
  );
};

const ForgotPassword = ({ setCurrentSection }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/auth/forgot-password`, { email });

      if (response.data.success) {
        // Send email with EmailJS
        const templateParams = {
          email: email,
          from_name: 'Ecostore',
          reply_to: 'naol42267@gmail.com',
          reset_code: response.data.tempPassword
        };

        // EmailJS credentials
        const SERVICE_ID = 'service_rplkun8';
        const TEMPLATE_ID = 'template_s0q2yef';
        const PUBLIC_KEY = '4x2ls5THMK_1RRe4W';

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

        alert('Password reset email sent! Check your inbox.');
        setCurrentSection('login');
      } else {
        alert(response.data.message || 'Email not found');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      alert('Failed to send reset email. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <section className="section active">
      <div className="auth-container">
        <div className="auth-form">
          <h2>Forgot Password</h2>
          <p>Enter your email address and we'll send you a temporary password.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Email'}
            </button>
          </form>
          <p style={{textAlign: 'center', marginTop: '10px'}}>
            <a href="#" onClick={() => setCurrentSection('login')} style={{color: '#2196F3'}}>Back to Login</a>
          </p>
        </div>
      </div>
    </section>
  );
};

const getCategoryIcon = (categoryName) => {
  const icons = {
    'Electronics': 'laptop',
    'Clothing': 'tshirt',
    'Home': 'home'
  };
  return icons[categoryName] || 'box';
};

export default App;