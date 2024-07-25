import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import sendNewsletter from "./SendMail.js";
// import mysql from 'mysql2';
const app=express();
const _dirname=dirname(fileURLToPath(import.meta.url));
const port=3000;
app.set('view engine', 'ejs');
app.set('views', _dirname + '/views'); // Set the path to the views directory
app.use(express.json())
app.use(bodyParser.urlencoded({extended:true}));
app.use(cookieParser());
app.use(express.static( _dirname + "/public"));
app.set('views', _dirname + '/views'); // Set the path to the views directory

const Secret_key="kjgsduhjh!@@#@#$87638";

const db=new pg.Client({
    host:"localhost",
    password:"SdvhiyFHp345#",
    database:"vsa",
    port:4000,
    user:"postgres",
});


// Create the connection to the database
// const connection = mysql.createConnection({
//   host: 'localhost', // Your database host
//   user: 'root',      // Your database user
//   password: 'password', // Your database password
//   database: 'database_name' // Your database name
// });

// Connect to the database
// connection.connect((err) => {
//   if (err) {
//     console.error('Error connecting to the database:', err.stack);
//     return;
//   }
//   console.log('Connected to the database as id ' + connection.threadId);
// });

// export default connection;

// below is the middle ware to prevent caching of authenticated pages iske wajah se back button dabane per re logged in page pe nhi jayega
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.get("/newLogin",(req,res)=>{
    res.render("login.ejs");
    console.log("cannot render login page");
});

// yaha pe signup kai hai.
app.post("/SignUp",async (req,res)=>{
    const { FullName, SignUp_Email, SignUp_Password, Mobile_number } = req.body;
    const saltRounds=10;
    try {
        const salt=await bcrypt.genSalt(saltRounds);
        const hashedPassword= await bcrypt.hash(SignUp_Password,salt);
        const firstName=FullName.split(" ")[0];
        var i=0;// this is for user id
        let user_id=i++;
        try {
            const duplicateCheck=await db.query(`SELECT * FROM users WHERE email=$1 AND password_entered=$2;`,
                                                                            [SignUp_Email,SignUp_Password])
                                                                           
            if(duplicateCheck.rows.length > 0){
                res.render("login.ejs",{                    
                        signUp_ToolTip:true,                    
                })
                console.log("Duplicate found");
            }else{
                await db.query("INSERT INTO users (full_name,email,password_entered,mobile_number,user_id) VALUES ($1,$2,$3,$4,$5)",
                                                            [FullName,SignUp_Email,hashedPassword,Mobile_number,user_id])
                res.render("index.ejs",{
                    Login:firstName,
        });   
            console.log("Added to the database");
            }                                                                            
        } catch (error) {
            console.log("User signUp problem Couldn't add to database" + error);
            res.render("login.ejs",{
                signUp_ToolTip:true,
            })
        }  

    } 
    catch (error) {
        console.error("Error during sign up:", error);
        res.render("login.ejs", {
            errorMessage: "An error occurred during sign up, please try again."
        });
    }
});

app.post("/Login",async(req,res)=>{
    const {Email,Password}=req.body;                                                            
    try {
        const enteredDetails = await db.query('SELECT * FROM users WHERE email=$1;',
                                                                    [Email]);                                                                   
        if(enteredDetails.rows.length > 0){    
            const userCheck = enteredDetails.rows[0];
            console.log("userCheck:", userCheck); // Debugging log                                                 
            const PassCheck= await bcrypt.compare(Password,userCheck.password_entered);
            if(PassCheck){          
                const firstName= userCheck.full_name.split(" ")[0];    
                const token = jwt.sign({ Email: userCheck.email ,fullName:userCheck.full_name,user_id:userCheck.user_id}, Secret_key, { expiresIn: "3d" });
                res.cookie("token", token, { httpOnly: true, secure: true });                                                            
                console.log(token);                   
                res.render("index.ejs",{
                    Login:firstName,
            });

            }else{
                console.log("Invalid Credentials")
                res.render("login.ejs",{
                    login_toolTip:true,
            });
            } 
         }else{
            console.log("User does not exist")
            res.render("login.ejs",{
                login_toolTip1:true,
                })
        
         }
        }catch (error) {
            console.log("error4")
        console.error("Error logging in:", error);
        res.render("login.ejs", {
            errorMessage: "An error occurred, please try again.",
        });
    }
})
// Below is the middleware that authenticates the jwt token
const authenticateUser = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        console.log("Token not found");
        req.user=null;
        // return res.status(401).send("Not authenticated");
        return next();
    }

    jwt.verify(token, Secret_key, (err, decoded) => {
        if (err) {
            console.error("Token verification failed:", err);
            return res.status(401).send("Invalid token");
        }

        // Attach decoded user information to the request object
        req.user = decoded;
        next();
    });
};

app.get("/",authenticateUser,(req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];

        res.render("index.ejs",{
            Login:firstName,
        });
        
        console.log("Sucessfully opened Home with user log in")
    }
    else{
        res.render("index.ejs",{
            Login:null,
        });
        console.log("Sucessfully opened Home without user logged in")
        
    }
});
// yaha pe shop ka hai.
app.get("/Shop",authenticateUser,async (req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        try {
            const {rows:item_data}=await db.query("SELECT * FROM stock_skates")
            console.log("Stocks successfully retried=ved from database with user login");
            res.render("Shop.ejs",{
                Login:firstName,
                items_data:item_data,
            });
            console.log("Sucessfully opened shop with user log in and item displayed")
        } catch (error) {
            console.log("Unable to retrive stock",error);
        }
    }
    else{
        const {rows:item_data}=await db.query("SELECT * FROM stock_skates")
        console.log("Stocks successfully retriedved from database without user login");
        res.render("Shop.ejs",{
            Login:null,
            items_data:item_data,
        });
        console.log("Sucessfully opened shop without user logged in")
    }
});
app.get("/Wheels",authenticateUser,async (req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        try {
            const {rows:item_data}=await db.query("SELECT * FROM stock_wheels")
            console.log("Stocks successfully retriedved Wheels from database with user login");
            res.render("Shop.ejs",{
                Login:firstName,
                items_data:item_data,
            });
            console.log("Sucessfully opened Wheels with user log in and item displayed")
        } catch (error) {
            console.log("Unable to retrive stock",error);
        }
    }
    else{
        const {rows:item_data}=await db.query("SELECT * FROM stock_wheels")
        console.log("Stocks successfully retriedved Wheels from database without user login");
        res.render("Shop.ejs",{
            Login:null,
            items_data:item_data,
        });
        console.log("Sucessfully opened Wheels without user logged in")
    }
});
app.get("/Helmets",authenticateUser,async (req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        try {
            const {rows:item_data}=await db.query("SELECT * FROM stock_helmets")
            console.log("Stocks successfully retriedved Helmets from database with user login");
            res.render("Shop.ejs",{
                Login:firstName,
                items_data:item_data,
            });
            console.log("Sucessfully opened Helmets with user log in and item displayed")
        } catch (error) {
            console.log("Unable to retrive stock",error);
        }
    }
    else{
        const {rows:item_data}=await db.query("SELECT * FROM stock_helmets")
        console.log("Stocks successfully retriedved Helmets from database without user login");
        res.render("Shop.ejs",{
            Login:null,
            items_data:item_data,
        });
        console.log("Sucessfully opened Helmets without user logged in")
    }
});
app.get("/SkinSuits",authenticateUser,async (req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        try {
            const {rows:item_data}=await db.query("SELECT * FROM stock_skinsuits")
            console.log("Stocks successfully retriedved SkinSuits from database with user login");
            res.render("Shop.ejs",{
                Login:firstName,
                items_data:item_data,
            });
            console.log("Sucessfully opened SkinSuits with user log in and item displayed")
        } catch (error) {
            console.log("Unable to retrive stock",error);
        }
    }
    else{
        const {rows:item_data}=await db.query("SELECT * FROM stock_skinsuits")
        console.log("Stocks successfully retriedved SkinSuits from database without user login");
        res.render("Shop.ejs",{
            Login:null,
            items_data:item_data,
        });
        console.log("Sucessfully opened SkinSuits without user logged in")
    }
});
app.get("/Accessories",authenticateUser,async (req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        try {
            const {rows:item_data}=await db.query("SELECT * FROM stock_accessories")
            console.log("Stocks successfully retriedved Accessories from database with user login");
            res.render("Shop.ejs",{
                Login:firstName,
                items_data:item_data,
            });
            console.log("Sucessfully opened Accessories with user log in and item displayed")
        } catch (error) {
            console.log("Unable to retrive stock",error);
        }
    }
    else{
        const {rows:item_data}=await db.query("SELECT * FROM stock_accessories")
        console.log("Stocks successfully retriedved Accessories from database without user login");
        res.render("Shop.ejs",{
            Login:null,
            items_data:item_data,
        });
        console.log("Sucessfully opened Accessories without user logged in")
    }
});
app.get("/Skates",(req,res)=>{
    res.redirect("/Shop");
    console.log("Succesfully redirected to shop ");
})
app.get("/AddToCart",authenticateUser,async(req,res)=>{
    const userId=req.user.user_id;
    if(!req.user){
        res.render("login.ejs");
        return res.status(401).send("User not authenticated");
    }
try {
    const{item_id,item_type}=req.body;
    console.log(item_id);
    console.log(item_type);
    try {
        const item_type_check = await db.query("SELECT * FROM stocks WHERE item_type=$1",[item_type]);
        console.log("Item type retrived successfully",item_type_check);
        const retrived_item_type_id=item_type_check.item_type_id;
        console.log("retrived item type id ",retrived_item_type_id);
        const itemAddedByUser=await db.query("SELECT * FROM stock_$1 WHERE item_id=$2",[item_type,item_id]);
        await db.query("INSERT INTO cart (user_id,img,name,description,item_id,price,quantity)",[userId,itemAddedByUser.img,itemAddedByUser.name,itemAddedByUser.description,itemAddedByUser.item_id,itemAddedByUser.price,quantity]);//yaha pe abhi quantity ka banana hai
    } catch (error) {
        console.log("could not add the item from database",error);
    }
} catch (error) {
    console.log("could not fetch the item from database",error)
}
})
// yaha pe Cart ka hai
app.get("/Cart",authenticateUser,async(req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        const {rows:addedItemOnCart}=await db.query("SELECT * FROM cart WHERE user_id=$1",[req.user.user_id]);
        res.render("Cart.ejs",{
            Login:firstName,
            Addeditem:addedItemOnCart,
        });
        console.log("Sucessfully opened Cart with user log in")
    }
    else{
        res.render("Cart.ejs",{
            Login:null,
        });
        console.log("Sucessfully opened Cart without user logged in")
        
    }
});
app.get("/Logout",(req,res)=>{
    res.clearCookie('token');
    res.redirect("/");
})
// app.post('/Logout', (req, res) => {
//     res.clearCookie('token');
//     res.redirect("/");
// });

app.use("/achievements",(req,res)=>{
    res.render("achievements.esj",{

    })
})
app.use("/FAQ",authenticateUser,async(req,res)=>{
    try {
        const {rows:FAQ_data}=await db.query("SELECT * FROM faq");
        res.render("FAQ.ejs",{FAQ_data});
    } catch (error) {
        console.log("Unable to fetch FAQ's data");

    }
})
app.get("/Profile",authenticateUser,async(req,res)=>{
    if(req.user){
        const firstName = req.user.fullName.split(" ")[0];
        try {
            const {rows:user_data}= await db.query("SELECT * FROM public.users");  
            res.render("profile.ejs",{
                Login:firstName,
                user_data:user_data,
            });
        } catch (error) {
            
        }
        

        console.log("Sucessfully opened profile with user log in")
    }
    else{
        res.render("login.ejs");
        console.log("Sucessfully opened login as user is not logged in")  
    }

})
// yaha pe news letter jo subscribe kiya hai uska hai.
app.post("/subscribedToNewsLetter",authenticateUser,async(req,res)=>{
    if(req.user){
        try {
            const Email=req.body;
            if(Email){
                const checkDuplicateEmail_forNewsLetter=await db.query("SELECT * FROM news_letter_subscriber WHERE email=$1",[Email]);
                if(checkDuplicateEmail_forNewsLetter){
                    res.render("/");
                    res.send("Email already exist");
                    console("Email already exist");
                }else{
                    await db.query("INSERT INTO news_letter_subscriber(email) VALUES($1)",[Email]);
                    res.render("/");
                    res.send("Email successfully added for news letter");
                    console.log("Email successfully added for news letter");
                }
            }
        } catch (error) {
            res.redirect("/");
            console.log("Failed to get email subscribe news letter route",error); 
        }
    }
    else{
        res.redirect("/newLogin");
        console.log("User not logged in and trying to subscribe to newsLetter that is why redirected to login page")
        }
});
// yaha pe news letter create karne aka hai for admin.
app.get("/Create_newsLetter",authenticateUser,async(req,res)=>{
    // if(req.user){
        res.render("CreateNewsLetter.ejs");
        console.log("News letter creation page opened")
    // }
})
// yaha pe news letter bhejne ka hai for admin.
app.post("/sendNewsLetter",async(req,res)=>{
    const { Title, Description } = req.body;
    const subscribers = await news_letter_subscriber.find();

    subscribers.forEach(subscriber => {
        sendNewsletter(subscriber.email,Title, Description);
    });

    res.send('Newsletter sent!');
    res.redirect("/");
})
db.connect();
app.listen(port,()=>{
    console.log(`Listening on port:${port}`);
})
