// frontend/app/dashboard/page.js
'use client';

import { useEffect, useState } from 'react';
import { analyticsAPI, deviceAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  HardDrive, 
  Database, 
  Wifi, 
  WifiOff, 
  Activity,
  LogOut,
  Settings,
  Bell
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    loadData();
  }, [user, router]);

  async function loadData() {
    try {
      const [statsData, devicesData] = await Promise.all([
        analyticsAPI.getSummary(),
        deviceAPI.getAll({ limit: 10 })
      ]);
      
      setStats(statsData);
      setDevices(devicesData.devices || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <LayoutDashboard className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">IoT Dashboard</h1>
                <p className="text-sm text-gray-500">Device Management Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <HardDrive className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Total Devices</div>
              <div className="text-3xl font-bold text-gray-900">{stats.devices.total}</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Wifi className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">
                  {stats.devices.total > 0 ? Math.round((stats.devices.online / stats.devices.total) * 100) : 0}%
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-1">Online Devices</div>
              <div className="text-3xl font-bold text-green-600">{stats.devices.online}</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <WifiOff className="w-6 h-6 text-gray-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Offline Devices</div>
              <div className="text-3xl font-bold text-gray-600">{stats.devices.offline}</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-1">Messages (24h)</div>
              <div className="text-3xl font-bold text-purple-600">{stats.telemetry.last24Hours}</div>
            </div>
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/devices"
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-xl hover:from-blue-600 hover:to-blue-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <HardDrive className="w-10 h-10 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Devices</h2>
            <p className="text-blue-100">Manage your IoT devices</p>
          </Link>

          {isAdmin() && (
            <Link
              href="/users"
              className="bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-xl hover:from-green-600 hover:to-green-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Users className="w-10 h-10 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Users</h2>
              <p className="text-green-100">Manage user accounts</p>
            </Link>
          )}

          <Link
            href="/data"
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-8 rounded-xl hover:from-purple-600 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Database className="w-10 h-10 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Data</h2>
            <p className="text-purple-100">View and export data</p>
          </Link>
        </div>

        {/* Recent Devices */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Devices</h2>
            <Link href="/devices" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center p-4 border rounded-lg">
                  <div className="h-10 w-10 bg-gray-200 rounded-lg mr-4"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <HardDrive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No devices registered yet</p>
              <Link
                href="/devices/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Your First Device
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map(device => (
                <Link
                  key={device._id}
                  href={`/devices/${device.serialNumber}`}
                  className="block p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className={`p-2 rounded-lg mr-4 ${
                        device.status === 'online' 
                          ? 'bg-green-50' 
                          : 'bg-gray-50'
                      }`}>
                        {device.status === 'online' ? (
                          <Wifi className="w-6 h-6 text-green-600" />
                        ) : (
                          <WifiOff className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{device.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span>Serial: {device.serialNumber}</span>
                          <span>•</span>
                          <span className="capitalize">{device.deviceType.replace('_', ' ')}</span>
                          {device.lastSeen && (
                            <>
                              <span>•</span>
                              <span>Last seen: {new Date(device.lastSeen).toLocaleString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      device.status === 'online' 
                        ? 'bg-green-100 text-green-800'
                        : device.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {device.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}