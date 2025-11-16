"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/components/footer";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "customer",
    name: "",
    phoneNumber: "",
    email: "",
    address: "",
    dateOfBirth: "",
    gender: "",
  });

  const [error, setError] = useState("");
  const router = useRouter();
  const { setUser } = useAuth();

  /* ----------------------- LOGIN ----------------------- */
  const handleLogin = async () => {
    try {
      const q = query(
        collection(db, "user"),
        where("username", "==", form.username),
        where("password", "==", form.password)
      );

      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Invalid username or password");
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data();

      let fullUser = {
        userId: userDoc.id,
        role: userData.role,
        customerId: userData.customerId,
      };

      if (userData.role === "customer") {
        const cRef = doc(db, "customer", String(userData.customerId));
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          fullUser = { ...fullUser, ...cSnap.data() };
        }
      }

      setUser(fullUser);
      router.push(userData.role === "staff" ? "/delivery" : "/");
    } catch (err) {
      console.error(err);
      setError("Login failed");
    }
  };

  /* ----------------------- SIGNUP ----------------------- */
  const handleSignup = async () => {
    try {
      // check username exists
      const q = query(
        collection(db, "user"),
        where("username", "==", form.username)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError("Username already exists");
        return;
      }

      // 1) create customer record
      const customerRef = await addDoc(collection(db, "customer"), {
        name: form.name,
        phoneNumber: form.phoneNumber,
        email: form.email,
        address: form.address,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
      });

      const newCustomerId = customerRef.id;

      // 2) create user record
      await setDoc(doc(db, "user", String(newCustomerId)), {
        username: form.username,
        password: form.password,
        role: form.role,
        customerId: newCustomerId,
      });

      alert("Account created! Please log in.");
      setIsSignup(false);
    } catch (err) {
      console.error(err);
      setError("Signup failed");
    }
  };

  /* ---------------------- HANDLER ----------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isSignup) return handleSignup();
    return handleLogin();
  };

  /* ------------------------- UI ------------------------- */
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <div className="max-w-sm mx-auto mt-16 p-6 border rounded">
          <h2 className="text-2xl font-bold mb-4">
            {isSignup ? "Sign Up" : "Log In"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            <input
              className="w-full border px-3 py-2 rounded"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            {/* Sign Up Extra Fields */}
            {isSignup && (
              <>
                <input
                  className="w-full border px-3 py-2 rounded"
                  placeholder="Full Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="w-full border px-3 py-2 rounded"
                  placeholder="Phone Number"
                  value={form.phoneNumber}
                  onChange={(e) =>
                    setForm({ ...form, phoneNumber: e.target.value })
                  }
                />
                <input
                  className="w-full border px-3 py-2 rounded"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <input
                  className="w-full border px-3 py-2 rounded"
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <input
                  className="w-full border px-3 py-2 rounded"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: e.target.value })
                  }
                />

                <select
                  className="w-full border px-3 py-2 rounded"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>

                <select
                  className="w-full border px-3 py-2 rounded"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="customer">Customer</option>
                  <option value="staff">Staff</option>
                </select>
              </>
            )}

            {error && <div className="text-red-500">{error}</div>}

            <button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded transition-colors"
              type="submit"
            >
              {isSignup ? "Sign Up" : "Log In"}
            </button>
          </form>

          <div className="mt-4 text-center">
            {isSignup ? (
              <span>
                Already have an account?{" "}
                <button
                  className="text-yellow-600 hover:text-yellow-800 font-semibold transition-colors"
                  onClick={() => setIsSignup(false)}
                >
                  Log In
                </button>
              </span>
            ) : (
              <span>
                Don&apos;t have an account?{" "}
                <button
                  className="text-yellow-600 hover:text-yellow-800 font-semibold transition-colors"
                  onClick={() => setIsSignup(true)}
                >
                  Sign Up
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}