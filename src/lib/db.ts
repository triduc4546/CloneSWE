// src/lib/db.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  WhereFilterOp,
} from "firebase/firestore";

import { db } from "./firebase";

//
// ✅ GET by ID
//
export async function getById(collectionName: string, id: string) {
  const ref = doc(db, collectionName, id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

//
// ✅ GET ALL
//
export async function getAll(collectionName: string) {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

//
// ✅ WHERE query
//
export async function getWhere(
  collectionName: string,
  field: string,
  operator: WhereFilterOp,
  value: any
) {
  const q = query(collection(db, collectionName), where(field, operator, value));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

//
// ✅ INSERT / UPDATE
//
export async function save(collectionName: string, id: string, data: any) {
  const ref = doc(db, collectionName, id);
  await setDoc(ref, data, { merge: true });
  return true;
}

//
// ✅ UPDATE
//
export async function update(collectionName: string, id: string, data: any) {
  const ref = doc(db, collectionName, id);
  await updateDoc(ref, data);
  return true;
}

//
// ✅ DELETE
//
export async function remove(collectionName: string, id: string) {
  const ref = doc(db, collectionName, id);
  await deleteDoc(ref);
  return true;
}