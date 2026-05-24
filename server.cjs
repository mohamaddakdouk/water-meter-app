const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Serve generated bill PDFs from the public/bills folder
app.use('/bills', express.static(path.join(__dirname, 'public', 'bills')));

const billsDir = path.join(__dirname, 'public', 'bills');
if (!fs.existsSync(billsDir)) fs.mkdirSync(billsDir, { recursive: true });


// Connect to MongoDB using the smart_water_meter database
mongoose.connect('mongodb://127.0.0.1:27017/smart_water_meter')
    .then(() => console.log("🚀 DB Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// Define Mongoose models and schemas
const Reading = mongoose.model('Reading', new mongoose.Schema({
    meterID: mongoose.Schema.Types.Mixed,
    totalLiters: mongoose.Schema.Types.Mixed,
    turbidity: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}), 'sensor_readings');

const Alert = mongoose.model('Alert', new mongoose.Schema({
    message: String,
    meterID: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}), 'alerts');

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    meterID: { type: mongoose.Schema.Types.Mixed, required: true },
    phone: { type: String, default: "" } // Keep phone numbers as strings so leading zeros remain
}, { strict: false }), 'users');


const Admin = mongoose.model('Admin', new mongoose.Schema({
    username: { type: String }, password: { type: String }
}), 'admins');

// Helper to match mixed-type meter IDs in the database
const idMatch = (id) => ({ $in: [id, Number(id), String(id)] });

// Login API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Lookup documents across both collections
        const user = await User.findOne({ username, password });
        const admin = await Admin.findOne({ username, password });
        const account = user || admin;

        if (!account) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        // Explicitly set roles and fallbacks to prevent undefined values
        const role = user ? 'user' : 'admin';
        const meterID = user ? user.meterID : 'ADMIN_ACCOUNT';

        const token = jwt.sign({ id: account._id }, "SECRET");

        // Send structured, solid payload back to Vite proxy
        res.json({ 
            success: true, 
            token, 
            role, 
            meterID 
        });

    } catch (e) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});


// Get Latest Readings for a Meter
app.get('/api/status/:id', async (req, res) => {
    try {
        const mID = req.params.id;
        // Find the latest exact reading for this meter
        const live = await Reading.findOne({ meterID: idMatch(mID) }).sort({ timestamp: -1 });
        const alerts = await Alert.find({ meterID: idMatch(mID) }).sort({ timestamp: -1 }).limit(5);

        res.json({
            live: live ? { 
                totalLiters: Math.floor(Number(live.totalLiters)) || 0, 
                turbidity: Number(live.turbidity) || 0 
            } : { totalLiters: 0, turbidity: 0 },
            alerts: alerts || []
        });
    } catch (e) { res.json({ live: {totalLiters: 0}, alerts: [] }); }
});


// Daily history: Pure (Current - Previous) logic.
app.get('/api/history/daily/:id', async (req, res) => {
    try {
        const mID = idMatch(req.params.id);
        const dailyData = await Reading.aggregate([
            { $match: { meterID: mID } },
            { $sort: { timestamp: 1 } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                cumulativeLiters: { $last: "$totalLiters" } 
            }}, 
            { $sort: { _id: 1 } },
            { $setWindowFields: {
                sortBy: { _id: 1 },
                output: {
                    previousLiters: {
                        $shift: {
                            output: "$cumulativeLiters",
                            by: -1,
                            default: 0 
                        }
                    }
                }
            }},
            { $project: { 
                _id: 0, 
                name: "$_id", 
                liters: { $subtract: ["$cumulativeLiters", "$previousLiters"] } 
            }}
        ]);
        res.json(dailyData.slice(-7)); 
    } catch (e) { res.json([]); }
});


// Monthly history: Pure (Current - Previous) logic. 
app.get('/api/history/monthly/:id', async (req, res) => {
    try {
        const mID = idMatch(req.params.id);
        const monthlyData = await Reading.aggregate([
            { $match: { meterID: mID } },
            { $sort: { timestamp: 1 } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
                cumulativeLiters: { $last: "$totalLiters" } 
            }}, 
            { $sort: { _id: 1 } },
            { $setWindowFields: {
                sortBy: { _id: 1 },
                output: {
                    previousLiters: {
                        $shift: {
                            output: "$cumulativeLiters",
                            by: -1,
                            default: 0 
                        }
                    }
                }
            }},
            { $project: { 
                _id: 0, 
                name: "$_id", 
                liters: { $subtract: ["$cumulativeLiters", "$previousLiters"] } 
            }}
        ]);
        res.json(monthlyData.slice(-12)); 
    } catch (e) { res.json([]); }
});



// Admin: Add User
app.post('/api/admin/users/add', async (req, res) => {
    try {
        const { username, password, meterID, phone } = req.body;
        const idMatch = [meterID, Number(meterID), String(meterID)];
        const existingUser = await User.findOne({ meterID: { $in: idMatch } });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "Meter ID already assigned to another user!" });
        }

        const newUser = new User({ username, password, meterID, phone });
        await newUser.save();
        
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
});


// Admin: Delete User
app.delete('/api/admin/users/delete/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// Admin: Get All Data
app.get('/api/admin/users', async (req, res) => res.json(await User.find({})));
app.get('/api/admin/alerts', async (req, res) => res.json(await Alert.find({}).sort({timestamp: -1})));
app.get('/api/admin/bills', async (req, res) => {
    const bills = await mongoose.connection.collection('bills').find({}).toArray();
    res.json(bills);
});

// Admin: Generate Bills
app.post('/api/admin/generate-bills', async (req, res) => {
    try {
        const { pricePerLiter } = req.body;
        const users = await User.find({});
        
        for (let user of users) {
            const lastReading = await Reading.findOne({ meterID: idMatch(user.meterID) }).sort({ timestamp: -1 });
            
            if (lastReading) {
                const consumption = Number(lastReading.totalLiters) || 0;
                const totalAmount = consumption * Number(pricePerLiter);
                const period = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                const pdfName = `Bill_${user.meterID}.pdf`;
                const pdfPath = path.join(billsDir, pdfName);

                const doc = new PDFDocument({ margin: 50 });
                doc.pipe(fs.createWriteStream(pdfPath));

                // PDF Header 
                doc.fontSize(20).text('SMART STREAM WATER BILL', { align: 'center' });
                doc.moveDown();
                doc.fontSize(10).text(`Bill Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
                doc.text(`Customer: ${user.username}`);
                doc.text(`Meter ID: ${user.meterID}`);
                doc.text(`Period: ${period}`);
                doc.moveDown();

                // DRAWING THE TABLE 
                const tableTop = 180;
                const itemCodeX = 50;
                const descriptionX = 150;
                const quantityX = 300;
                const priceX = 400;
                const totalX = 500;

                // Table Header Row
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Code', itemCodeX, tableTop);
                doc.text('Description', descriptionX, tableTop);
                doc.text('Usage (L)', quantityX, tableTop);
                doc.text('Price/USD', priceX, tableTop);
                doc.text('Total', totalX, tableTop);

                doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke(); // Underline Header

                // Table Content Row
                doc.fontSize(10).font('Helvetica');
                const rowY = tableTop + 30;
                doc.text('WTR-01', itemCodeX, rowY);
                doc.text('Water Consumption', descriptionX, rowY);
                doc.text(`${consumption}`, quantityX, rowY);
                doc.text(`${pricePerLiter}`, priceX, rowY);
                doc.text(`${totalAmount.toLocaleString()} USD`, totalX, rowY);

                doc.moveTo(50, rowY + 15).lineTo(550, rowY + 15).stroke(); // Underline Content

                // --- Final Summary ---
                doc.moveDown(4);
                doc.fontSize(14).font('Helvetica-Bold').text(`GRAND TOTAL: ${totalAmount.toLocaleString()} USD`, { align: 'right' });
                
                doc.moveDown(2);
                doc.fontSize(10).font('Helvetica-Oblique').text('Notes: Please pay within 15 days to avoid service interruption.', { align: 'center' });

                doc.end();

                // Save to Database
                await mongoose.connection.collection('bills').insertOne({
                    meterID: user.meterID,
                    consumption,
                    totalAmount,
                    billingPeriod: period,
                    pdfFile: pdfName,
                    status: 'Unpaid',
                    timestamp: new Date()
                });

                // Send Alert with Link
                await new Alert({
                    meterID: user.meterID,
                    message: `New Bill Issued: ${totalAmount.toLocaleString()} USD. [LINK:${pdfName}]`,
                    timestamp: new Date()
                }).save();
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// ADMIN: FORCE TOGGLE BILL TO PAID ---
app.put('/api/admin/bills/pay/:id', async (req, res) => {
    try {
        const { ObjectId } = require('mongoose').Types;
        const billId = req.params.id;

        if (!ObjectId.isValid(billId)) {
            return res.status(400).json({ success: false, message: "Invalid Hex ID structure" });
        }

        const targetOid = new ObjectId(billId);

        // Update status field directly inside the bills collection structure
        const updateResult = await mongoose.connection.collection('bills').updateOne(
            { _id: targetOid },
            { $set: { status: 'Paid' } }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Bill not found in collection" });
        }

        // Get meter info to dispatch notification alert
        const bill = await mongoose.connection.collection('bills').findOne({ _id: targetOid });
        if (bill) {
            await new Alert({
                meterID: bill.meterID,
                message: `✅ Invoice Paid: Statement for ${bill.billingPeriod} has been cleared.`,
                timestamp: new Date()
            }).save();
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});



app.listen(5000, '127.0.0.1', () => console.log("📡 Backend ON 5000"));
