const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');

// Mongoose schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'customer' },
  created_at: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  stock: Number,
  category_id: Number,
  image_url: String,
  seller_id: mongoose.Schema.Types.ObjectId,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now },
  created_by: mongoose.Schema.Types.ObjectId
});

const orderSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  total: Number,
  payment_method: String,
  shipping_address: String,
  status: { type: String, default: 'pending' },
  tx_ref: String,
  created_at: { type: Date, default: Date.now }
});

const orderItemSchema = new mongoose.Schema({
  order_id: mongoose.Schema.Types.ObjectId,
  product_id: mongoose.Schema.Types.ObjectId,
  quantity: Number,
  price: Number
});

const categorySchema = new mongoose.Schema({
  name: String
});

// Models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const OrderItem = mongoose.model('OrderItem', orderItemSchema);
const Category = mongoose.model('Category', categorySchema);

const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ecostore').then(() => {
    console.log('Database connected successfully');
}).catch((err) => {
    console.log('Database connection failed:', err);
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({
            $or: [{ status: 'approved' }, { seller_id: null }]
        }).populate('seller_id', 'name');
        res.json(products);
    } catch (err) {
        console.log('Database error:', err);
        res.status(500).json({error: err.message});
    }
});

app.post('/api/auth/login', async (req, res) => {
    const {email, password} = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({success: false, message: 'Invalid credentials'});
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            const {password: _, ...userWithoutPassword} = user.toObject();
            res.json({success: true, user: userWithoutPassword});
        } else {
            res.json({success: false, message: 'Invalid credentials'});
        }
    } catch (error) {
        console.log('Login error:', error);
        res.status(500).json({success: false, message: 'Login failed'});
    }
});

app.post('/api/auth/register', async (req, res) => {
    const {fullName, email, password, role} = req.body;

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.json({success: false, message: 'Email already registered'});
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({
            name: fullName,
            email,
            password: hashedPassword,
            role: role || 'customer'
        });

        await newUser.save();
        res.json({success: true, message: 'Registration successful'});
    } catch (error) {
        console.log('Registration error:', error);
        res.status(500).json({success: false, error: 'Registration failed'});
    }
});

app.post('/api/orders', async (req, res) => {
    const {user_id, total, payment_method, shipping_address, items, status} = req.body;

    try {
        const order = new Order({
            user_id,
            total,
            payment_method,
            shipping_address,
            status: status || 'pending'  // Use provided status or default to pending
        });

        const savedOrder = await order.save();
        const orderId = savedOrder._id;

        const orderItems = items.map(item => ({
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
        }));

        await OrderItem.insertMany(orderItems);

        // Update stock
        for (const item of items) {
            const product = await Product.findById(item.product_id);
            if (!product) {
                throw new Error(`Product not found for id: ${item.product_id}`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
            }
            product.stock -= item.quantity;
            await product.save();
        }

        res.json({success: true, orderId: orderId});
    } catch (err) {
        res.status(500).json({success: false, error: err.message});
    }
});

app.get('/api/orders/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        // Get all orders and filter by user_id to handle any type mismatches
        const allOrders = await Order.find({}).sort({ created_at: -1 });
        const orders = allOrders.filter(order => order.user_id && order.user_id.toString() === userId);

        // For each order, get the items
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const orderItems = await OrderItem.find({ order_id: order._id }).populate('product_id', 'name');
            const itemsString = orderItems.map(item =>
                `${item.product_id ? item.product_id.name : 'Unknown Product'} x ${item.quantity} @ ${parseFloat(item.price).toFixed(2)} ETB`
            ).join(', ');

            return {
                ...order.toObject(),
                id: order._id.toString(), // Add id field for frontend compatibility
                items: itemsString
            };
        }));

        res.json(ordersWithItems);
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({error: err.message});
    }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find({}, 'name email role created_at').sort({ created_at: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.post('/api/admin/products', async (req, res) => {
    const {name, description, price, stock, category_id, image_url} = req.body;
    try {
        const product = new Product({
            name,
            description,
            price: Number(price),
            stock: Number(stock),
            category_id: category_id ? Number(category_id) : undefined,
            image_url,
            status: 'approved'
        });
        const savedProduct = await product.save();
        res.json({success: true, productId: savedProduct._id});
    } catch (err) {
        console.error('Product creation error:', err);
        console.error('Full error details:', err);
        res.status(500).json({error: err.message});
    }
});

app.put('/api/admin/products/:id', async (req, res) => {
    const productId = req.params.id;
    const {name, description, price, stock, category_id, image_url} = req.body;
    try {
        await Product.findByIdAndUpdate(productId, {
            name,
            description,
            price,
            stock,
            category_id,
            image_url
        });
        res.json({success: true, message: 'Product updated successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        await Product.findByIdAndDelete(productId);
        res.json({success: true, message: 'Product deleted successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.put('/api/admin/products/:id/status', async (req, res) => {
    const productId = req.params.id;
    const {status} = req.body;
    try {
        await Product.findByIdAndUpdate(productId, { status });
        res.json({success: true, message: 'Product status updated successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find({}).populate('user_id', 'name email').sort({ created_at: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.put('/api/admin/orders/:id/status', async (req, res) => {
    const orderId = req.params.id;
    const {status} = req.body;
    try {
        await Order.findByIdAndUpdate(orderId, { status });
        res.json({success: true, message: 'Order status updated successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.put('/api/orders/:id/status', async (req, res) => {
    const orderId = req.params.id;
    const {status, userId} = req.body;

    // Only allow customers to mark orders as delivered
    if (status !== 'delivered') {
        return res.status(400).json({success: false, message: 'Invalid status update'});
    }

    try {
        const order = await Order.findOne({ _id: orderId, user_id: userId });

        if (!order) {
            return res.status(404).json({success: false, message: 'Order not found'});
        }

        if (order.status !== 'shipped') {
            return res.status(400).json({success: false, message: 'Order must be shipped to mark as delivered'});
        }

        await Order.findOneAndUpdate({ _id: orderId, user_id: userId }, { status });
        res.json({success: true, message: 'Order marked as delivered successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.put('/api/orders/:id/tx_ref', async (req, res) => {
    const orderId = req.params.id;
    const { tx_ref } = req.body;

    try {
        await Order.findByIdAndUpdate(orderId, { tx_ref });
        res.json({ success: true, message: 'Order updated with tx_ref' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/role', async (req, res) => {
    const userId = req.params.id;
    const {role} = req.body;
    try {
        await User.findByIdAndUpdate(userId, { role });
        res.json({success: true, message: 'User role updated successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        await User.findByIdAndDelete(userId);
        res.json({success: true, message: 'User deleted successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.post('/api/admin/users', async (req, res) => {
    const {name, email, password, role} = req.body;

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.json({success: false, message: 'Email already exists'});
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        await newUser.save();
        res.json({success: true, message: 'User created successfully'});
    } catch (error) {
        res.status(500).json({error: 'Failed to create user'});
    }
});

app.get('/api/admin/pending-products', async (req, res) => {
    try {
        const products = await Product.find({ status: 'pending' }).populate('seller_id', 'name');
        res.json(products);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/admin/sales-report', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Get total orders
        const totalOrders = await Order.countDocuments({
            created_at: { $gte: thirtyDaysAgo },
            status: { $in: ['shipped', 'delivered'] }
        });

        // Get total revenue
        const revenueResult = await OrderItem.aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {
                $lookup: {
                    from: 'orders',
                    localField: 'order_id',
                    foreignField: '_id',
                    as: 'order'
                }
            },
            {
                $match: {
                    'product.seller_id': { $ne: null },
                    'order.status': { $in: ['shipped', 'delivered'] },
                    'order.created_at': { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    total_revenue: { $sum: { $multiply: ['$price', '$quantity'] } }
                }
            }
        ]);

        const totalRevenue = revenueResult[0]?.total_revenue || 0;
        const platformCommission = totalRevenue * 0.05;

        res.json({
            summary: {
                total_orders: totalOrders,
                total_revenue: totalRevenue.toFixed(2),
                platform_commission: platformCommission.toFixed(2)
            },
            daily_data: [] // Simplified - daily data would require more complex aggregation
        });
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const {email} = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({success: false, message: 'Email not found'});
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });

        res.json({success: true, tempPassword: tempPassword, user: {name: user.name, email: user.email}});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.put('/api/auth/profile', async (req, res) => {
    const {userId, name, email, currentPassword, newPassword} = req.body;

    try {
        if (newPassword && currentPassword) {
            const user = await User.findById(userId);
            if (!user) {
                return res.json({success: false, message: 'User not found'});
            }

            const passwordMatch = await bcrypt.compare(currentPassword, user.password);

            if (!passwordMatch) {
                return res.json({success: false, message: 'Current password is incorrect'});
            }

            const saltRounds = 10;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

            await User.findByIdAndUpdate(userId, {
                name,
                email,
                password: hashedNewPassword
            });
            res.json({success: true, message: 'Profile and password updated successfully'});
        } else {
            await User.findByIdAndUpdate(userId, { name, email });
            res.json({success: true, message: 'Profile updated successfully'});
        }
    } catch (error) {
        res.status(500).json({success: false, error: 'Profile update failed'});
    }
});

app.get('/api/seller/products/:sellerId', async (req, res) => {
    const sellerId = req.params.sellerId;
    try {
        const products = await Product.find({ seller_id: sellerId }).sort({ created_at: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.post('/api/seller/products', async (req, res) => {
    const {name, description, price, stock, category_id, image_url, seller_id} = req.body;
    try {
        const product = new Product({
            name,
            description,
            price: Number(price),
            stock: Number(stock),
            category_id: category_id || undefined,
            image_url,
            seller_id: seller_id,
            status: 'pending'
        });
        const savedProduct = await product.save();
        res.json({success: true, productId: savedProduct._id});
    } catch (err) {
        console.error('Product creation error:', err);
        res.status(500).json({error: err.message});
    }
});

app.put('/api/seller/products/:id', async (req, res) => {
    const productId = req.params.id;
    const {name, description, price, stock, category_id, image_url, seller_id} = req.body;
    try {
        await Product.findOneAndUpdate(
            { _id: productId, seller_id: seller_id },
            { name, description, price, stock, category_id, image_url }
        );
        res.json({success: true, message: 'Product updated successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.delete('/api/seller/products/:id', async (req, res) => {
    const productId = req.params.id;
    const {seller_id} = req.body;
    try {
        await Product.findOneAndDelete({ _id: productId, seller_id: new mongoose.Types.ObjectId(seller_id) });
        res.json({success: true, message: 'Product deleted successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/seller/orders/:sellerId', async (req, res) => {
    const sellerId = req.params.sellerId;

    try {
        // Find order items where product seller_id matches, then get unique orders
        const orderItems = await OrderItem.find({}).populate({
            path: 'product_id',
            match: { seller_id: sellerId }
        });

        const orderIds = [...new Set(orderItems.filter(item => item.product_id).map(item => item.order_id))];

        const orders = await Order.find({ _id: { $in: orderIds } }).populate('user_id', 'name email').sort({ created_at: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.get('/api/seller/earnings/:sellerId', async (req, res) => {
    const sellerId = req.params.sellerId;

    try {
        const result = await OrderItem.aggregate([
            {
                $lookup: {
                    from: 'products',
                    localField: 'product_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {
                $lookup: {
                    from: 'orders',
                    localField: 'order_id',
                    foreignField: '_id',
                    as: 'order'
                }
            },
            {
                $match: {
                    'product.seller_id': new mongoose.Types.ObjectId(sellerId),
                    'order.status': { $in: ['shipped', 'delivered'] }
                }
            },
            {
                $group: {
                    _id: null,
                    total_sales: { $sum: { $multiply: ['$price', '$quantity'] } }
                }
            }
        ]);

        const totalSales = result[0]?.total_sales || 0;
        const commission = totalSales * 0.05;
        const netEarnings = totalSales - commission;

        res.json({
            total_sales: totalSales.toFixed(2),
            commission: commission.toFixed(2),
            net_earnings: netEarnings.toFixed(2)
        });
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Admin routes for managing their own products
app.get('/api/admin/my-products/:adminId', async (req, res) => {
    const adminId = req.params.adminId;
    try {
        const products = await Product.find({ created_by: adminId }).sort({ created_at: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.post('/api/admin/my-products', async (req, res) => {
    const {name, description, price, stock, category_id, image_url, admin_id} = req.body;
    try {
        const product = new Product({
            name,
            description,
            price: Number(price),
            stock: Number(stock),
            category_id: category_id || undefined,
            image_url,
            created_by: admin_id,
            status: 'approved'
        });
        const savedProduct = await product.save();
        res.json({success: true, productId: savedProduct._id});
    } catch (err) {
        console.error('Product creation error:', err);
        res.status(500).json({error: err.message});
    }
});

app.put('/api/admin/my-products/:id', async (req, res) => {
    const productId = req.params.id;
    const {name, description, price, stock, category_id, image_url, admin_id} = req.body;
    try {
        await Product.findOneAndUpdate(
            { _id: productId, created_by: new mongoose.Types.ObjectId(admin_id) },
            { name, description, price, stock, category_id, image_url }
        );
        res.json({success: true, message: 'Product updated successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

app.delete('/api/admin/my-products/:id', async (req, res) => {
    const productId = req.params.id;
    const {admin_id} = req.body;
    try {
        await Product.findOneAndDelete({ _id: productId, created_by: admin_id });
        res.json({success: true, message: 'Product deleted successfully'});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Chapa Payment Integration
app.post('/api/payment/initialize', async (req, res) => {
    const { amount, email, first_name, last_name, phone_number, tx_ref } = req.body;
    
    try {
        const axios = require('axios');
        const CHAPA_SECRET_KEY = 'CHASECK_TEST-TDeUDP7E04YfxOe9JwLOeB4NnywmEBuu';
        
        const chapaData = {
            amount: amount,
            currency: 'ETB',
            email: email,
            first_name: first_name,
            last_name: last_name,
            phone_number: phone_number,
            tx_ref: tx_ref,
            callback_url: `${req.protocol}://${req.get('host')}/api/payment/callback`,
            return_url: `${req.protocol}://${req.get('host')}/`,
            customization: {
                title: 'EcoStore Payment',
                description: 'Payment for your order'
            }
        };

        const chapaResponse = await axios.post('https://api.chapa.co/v1/transaction/initialize', chapaData, {
            headers: {
                'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (chapaResponse.data.status === 'success') {
            res.json({
                success: true,
                checkout_url: chapaResponse.data.data.checkout_url
            });
        } else {
            res.json({ success: false, message: 'Payment initialization failed' });
        }
    } catch (error) {
        console.error('Chapa payment error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Payment service error' });
    }
});

app.post('/api/payment/callback', async (req, res) => {
    try {
        const { tx_ref } = req.body;

        if (tx_ref) {
            const order = await Order.findOne({ tx_ref });

            if (order && order.status === 'pending') {
                // Update order status to delivered
                await Order.findByIdAndUpdate(order._id, { status: 'delivered' });

                // Deduct stock
                const orderItems = await OrderItem.find({ order_id: order._id });
                for (const item of orderItems) {
                    const product = await Product.findById(item.product_id);
                    if (product) {
                        product.stock -= item.quantity;
                        await product.save();
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Payment callback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/payment/verify/:tx_ref', async (req, res) => {
    const { tx_ref } = req.params;
    
    try {
        const axios = require('axios');
        const CHAPA_SECRET_KEY = 'CHASECK_TEST-TDeUDP7E04YfxOe9JwLOeB4NnywmEBuu';
        
        const verifyResponse = await axios.get(`https://api.chapa.co/v1/transaction/verify/${tx_ref}`, {
            headers: { 'Authorization': `Bearer ${CHAPA_SECRET_KEY}` }
        });

        res.json(verifyResponse.data);
    } catch (error) {
        console.error('Payment verification error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
});

app.listen(5000, () => console.log('Server running on port 5000'));