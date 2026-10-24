'use client';
import dynamic from 'next/dynamic';
const Dashboard=dynamic(()=>import('@/components/ControllerDashboard'),{ssr:false});
export default function Page(){return <Dashboard view="system"/>;}
