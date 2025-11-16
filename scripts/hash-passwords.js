require("dotenv").config({ path: "../.env.local" }); // Load env from parent folder
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Get all users
  const [users] = await pool.query("SELECT userId, passwordHash FROM UserAccount");

  for (const user of users) {
    // Skip if already hashed (bcrypt hashes start with $2)
    if (user.passwordHash.startsWith("$2")) continue;

    const hash = await bcrypt.hash(user.passwordHash, 10);
    await pool.query(
      "UPDATE UserAccount SET passwordHash = ? WHERE userId = ?",
      [hash, user.userId]
    );
    console.log(`Updated userId ${user.userId}`);
  }

  await pool.end();
  console.log("Done!");
}

main().catch(console.error);