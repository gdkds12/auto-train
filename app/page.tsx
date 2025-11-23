// web/app/page.tsx
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ArrowRightLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KTX_STATIONS, SRT_STATIONS, TIMES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { StationSelector } from '@/components/common/station-selector';
import { AccountManager } from '@/components/common/account-manager';

type TrainMode = 'KTX' | 'SRT';

export interface TrainResult {
  trainNo: string;
  trainType: string;
  depTime: string;
  arrTime: string;
  depStation: string;
  arrStation: string;
  isAvailable: boolean;
  specialSeatAvailable: boolean;
  generalSeatAvailable: boolean;
  fare: number;
  runDate: string;
  trainId: string;
}

export default function Home() {
  const [mode, setMode] = React.useState<TrainMode>('KTX');
  const [depStation, setDepStation] = React.useState({ name: '서울', code: '0001' });
  const [arrStation, setArrStation] = React.useState({ name: '부산', code: '0017' });
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [time, setTime] = React.useState('09:00');
  const [selectedAccountId, setSelectedAccountId] = React.useState<number | null>(null);
  
  const [trainSearchResults, setTrainSearchResults] = React.useState<TrainResult[] | null>(null);
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  // New state for reservation task
  const [currentTaskId, setCurrentTaskId] = React.useState<number | null>(null);
  const [taskStatus, setTaskStatus] = React.useState<any>(null); // To store full task status with logs

  // New state for frontend logs
  const [frontendLogs, setFrontendLogs] = React.useState<string[]>([]);

  const addFrontendLog = React.useCallback((logMessage: string, level: 'INFO' | 'ERROR' = 'INFO') => {
    setFrontendLogs((prevLogs) => {
      const timestamp = new Date().toLocaleTimeString();
      return [...prevLogs, `[${timestamp}] ${level}: ${logMessage}`];
    });
  }, []);

  const stations = mode === 'KTX' ? KTX_STATIONS : SRT_STATIONS;

  React.useEffect(() => {
    if (mode === 'KTX') {
      setDepStation({ name: '서울', code: '0001' });
      setArrStation({ name: '부산', code: '0017' });
    } else {
      setDepStation({ name: '수서', code: '0551' });
      setArrStation({ name: '부산', code: '0017' });
    }
    setTrainSearchResults(null);
  }, [mode]);

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const fetchTaskStatus = async (id: number) => {
      addFrontendLog(`Fetching task status for ID: ${id}`);
      try {
        const response = await fetch(`/api/tasks/${id}`);
        addFrontendLog(`Response status for task ${id}: ${response.status} ${response.statusText}`);
        if (response.ok) {
          const statusData = await response.json();
          addFrontendLog(`Received task status data for ID: ${id}: ${JSON.stringify(statusData)}`);
          setTaskStatus(statusData);
          if (!statusData.isActive || statusData.status === 'SUCCESS' || statusData.status === 'FAILED' || statusData.status === 'STOPPED') {
            addFrontendLog(`Task ${id} finished with status: ${statusData.status}. Clearing interval.`, statusData.status === 'FAILED' ? 'ERROR' : 'INFO');
            clearInterval(intervalId);
            setCurrentTaskId(null); // Task is complete, stop monitoring
            setMessage(`Task ${statusData.status}: ${statusData.depStation} -> ${statusData.arrStation} (${statusData.selectedDepTime})`);
          }
        } else {
          const errorData = await response.json();
          addFrontendLog(`Failed to fetch task status for ${id}: ${errorData.message || response.statusText}`, 'ERROR');
          console.error(`Failed to fetch task status for ${id}:`, errorData);
          clearInterval(intervalId);
          setCurrentTaskId(null);
          setTaskStatus(null);
          setMessage(`Failed to monitor task status: ${errorData.message || response.statusText}`);
        }
      } catch (error: any) {
        addFrontendLog(`Error fetching task status for ${id}: ${error.message}`, 'ERROR');
        console.error(`Error fetching task status for ${id}:`, error);
        clearInterval(intervalId);
        setCurrentTaskId(null);
        setTaskStatus(null);
        setMessage(`Error monitoring task status: ${error.message}`);
      }
    };

    if (currentTaskId) {
      addFrontendLog(`Starting monitoring for task ID: ${currentTaskId}`);
      // Fetch immediately, then set interval
      fetchTaskStatus(currentTaskId);
      intervalId = setInterval(() => fetchTaskStatus(currentTaskId), 1000); // Poll every 1 second
    }

    return () => {
      if (intervalId) {
        addFrontendLog(`Cleaning up interval for task ID: ${currentTaskId}`);
        clearInterval(intervalId);
      }
    };
  }, [currentTaskId, addFrontendLog]);


  const handleSwapStations = () => {
    setDepStation(arrStation);
    setArrStation(depStation);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccountId) {
      setMessage('Please select an account first.');
      return;
    }
    if (!date) {
        setMessage('Please select a date.');
        return;
    }

    setIsLoading(true);
    setMessage('Searching for trains...');
    setTrainSearchResults(null);
    addFrontendLog('Initiating train search...');

    try {
      const response = await fetch('/api/trains/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          trainMode: mode,
          depStationName: depStation.name,
          arrStationName: arrStation.name,
          date: format(date, 'yyyyMMdd'),
          timeFrom: time.replace(':', '') + '00',
        }),
      });
      addFrontendLog(`Search API response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const results = await response.json();
        setTrainSearchResults(results);
        if (results.length === 0) {
            setMessage('No trains found for your criteria.');
            addFrontendLog('No trains found.');
        } else {
            setMessage('');
            addFrontendLog(`Found ${results.length} trains.`);
        }
      } else {
        const errorData = await response.json();
        setMessage(`Failed to search trains: ${errorData.message || response.statusText}`);
        addFrontendLog(`Failed to search trains: ${errorData.message || response.statusText}`, 'ERROR');
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
      addFrontendLog(`Error during train search: ${error.message}`, 'ERROR');
    } finally {
      setIsLoading(false);
      addFrontendLog('Train search finished.');
    }
  };

  const handleSelectTrainForReservation = async (train: TrainResult) => {
    if (!selectedAccountId) {
      setMessage('Please select an account first.');
      return;
    }
    if (!date) {
        setMessage('Please select a date.');
        return;
    }

    setIsLoading(true);
    setMessage('Initiating reservation...');
    addFrontendLog('Initiating reservation task creation...');
    try {
      const response = await fetch('/api/trains/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          trainMode: mode,
          depStation: train.depStation,
          arrStation: train.arrStation,
          date: format(date, 'yyyyMMdd'),
          timeFrom: train.depTime,
          selectedTrainNo: train.trainNo,
          selectedTrainType: train.trainType,
          selectedDepTime: train.depTime,
          selectedArrTime: train.arrTime,
          selectedTrainClass: train.generalSeatAvailable ? '일반실' : (train.specialSeatAvailable ? '특실' : null),
          selectedTrainId: train.trainId,
        }),
      });
      addFrontendLog(`Reservation API response status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const result = await response.json();
        setMessage(`Reservation task created successfully! Worker will now attempt to book. Monitoring Task ID: ${result.taskId}`);
        setCurrentTaskId(result.taskId); // Store the task ID
        setTrainSearchResults(null);
        addFrontendLog(`Reservation task created, ID: ${result.taskId}. Starting monitoring.`);
      } else {
        const errorData = await response.json();
        setMessage(`Failed to create reservation task: ${errorData.message || response.statusText}`);
        addFrontendLog(`Failed to create reservation task: ${errorData.message || response.statusText}`, 'ERROR');
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
      addFrontendLog(`Error during reservation task creation: ${error.message}`, 'ERROR');
    } finally {
      setIsLoading(false);
      addFrontendLog('Reservation task creation finished.');
    }
  };

  const handleCancelTask = async () => {
    if (!currentTaskId) return;

    setIsLoading(true);
    setMessage('Cancelling task...');
    addFrontendLog(`Attempting to cancel task ID: ${currentTaskId}`);
    try {
      const response = await fetch(`/api/tasks/${currentTaskId}/cancel`, {
        method: 'POST',
      });
      addFrontendLog(`Cancel API response status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        setMessage('Task cancelled successfully.');
        setTaskStatus((prev: any) => ({ ...prev, isActive: false, status: 'STOPPED' }));
        setCurrentTaskId(null); // Clear current task
        addFrontendLog(`Task ID: ${currentTaskId} cancelled successfully.`);
      } else {
        const errorData = await response.json();
        setMessage(`Failed to cancel task: ${errorData.message || response.statusText}`);
        addFrontendLog(`Failed to cancel task: ${errorData.message || response.statusText}`, 'ERROR');
      }
    } catch (error: any) {
      setMessage(`Error cancelling task: ${error.message}`);
      addFrontendLog(`Error cancelling task: ${error.message}`, 'ERROR');
    } finally {
      setIsLoading(false);
      addFrontendLog('Task cancellation process finished.');
    }
  };

  const TaskStatusDisplay = ({ task }: { task: any }) => (
    <Card className="mt-8 w-full">
      <CardHeader>
        <CardTitle className="text-xl">예약 매크로 진행 중 (ID: {task.id})</CardTitle>
        <CardDescription>
          {task.depStation} ({task.selectedDepTime}) → {task.arrStation} ({task.selectedTrainType})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>현재 상태: <strong>{task.status}</strong></p>
        <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-sm bg-gray-50 dark:bg-gray-700">
          {task.logs.length > 0 ? (
            task.logs.map((log: any, idx: number) => (
              <p key={idx} className={log.level === 'ERROR' ? 'text-red-500' : ''}>
                [{new Date(log.createdAt).toLocaleTimeString()}] {log.level}: {log.message}
              </p>
            ))
          ) : (
            <p>Waiting for activity...</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleCancelTask} disabled={!task.isActive} className="w-full">
          {task.isActive ? '매크로 중지' : `매크로 ${task.status === 'STOPPED' ? '중지됨' : task.status === 'SUCCESS' ? '성공' : '실패'}`}
        </Button>
      </CardFooter>
    </Card>
  );

  const FrontendLogDisplay = () => (
    <Card className="mt-4 w-full">
      <CardHeader>
        <CardTitle className="text-xl">Frontend Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-48 overflow-y-auto border rounded-md p-2 text-sm bg-gray-50 dark:bg-gray-700">
          {frontendLogs.length > 0 ? (
            frontendLogs.map((log: string, idx: number) => (
              <p key={idx} className={log.includes('ERROR') ? 'text-red-500' : ''}>
                {log}
              </p>
            ))
          ) : (
            <p>No frontend logs yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );


  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
      <div className="w-full max-w-md p-4 sm:p-0">
        <Tabs value={mode} onValueChange={(value) => setMode(value as TrainMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="KTX">KTX</TabsTrigger>
            <TabsTrigger value="SRT">SRT</TabsTrigger>
          </TabsList>
          <TabsContent value={mode}>
            <Card className="w-full">
              <form onSubmit={handleSearch}>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Train Search</CardTitle>
                  <CardDescription>
                    Select your account and search for available trains.
                  </CardDescription>
                  <AccountManager onSelectAccount={setSelectedAccountId}>
                    <Button variant="outline" className="w-full">
                      {selectedAccountId ? `Selected Account ID: ${selectedAccountId}` : 'Select Account'}
                    </Button>
                  </AccountManager>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  <div className="flex flex-col md:flex-row items-center md:space-x-2 space-y-2 md:space-y-0">
                    <StationSelector stations={stations} onSelect={setDepStation}>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-14 text-base sm:text-lg">
                        <span className="text-sm font-semibold text-muted-foreground w-10">출발</span>
                        {depStation.name}
                      </Button>
                    </StationSelector>
                    
                    <div className="w-full md:w-auto flex justify-center">
                      <Button variant="ghost" size="icon" onClick={handleSwapStations}>
                        <ArrowRightLeft className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    <StationSelector stations={stations} onSelect={setArrStation}>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-14 text-base sm:text-lg">
                        <span className="text-sm font-semibold text-muted-foreground w-10">도착</span>
                        {arrStation.name}
                      </Button>
                    </StationSelector>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label>Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !date && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, 'yyyy-MM-dd') : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <label>Time</label>
                      <Select value={time} onValueChange={setTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-center space-y-4">
                  <Button type="submit" disabled={isLoading || !!currentTaskId} className="w-full h-12 text-lg">
                    {isLoading ? 'Searching...' : (currentTaskId ? '매크로 실행 중...' : 'Search for Tickets')}
                  </Button>
                  {message && (
                    <p className={`text-sm ${message.startsWith('Failed') || message.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                      {message}
                    </p>
                  )}
                </CardFooter>
              </form>
            </Card>

            {currentTaskId && taskStatus ? (
              <>
                <TaskStatusDisplay task={taskStatus} />
                <FrontendLogDisplay />
              </>
            ) : (
              <>
                {trainSearchResults && trainSearchResults.length > 0 && (
                  <div className="mt-8 w-full px-4 sm:px-0 space-y-4">
                    <h2 className="text-xl font-bold mb-4">Available Trains</h2>
                    {trainSearchResults.map((train, index) => (
                      <Card key={index} className="w-full">
                        <CardHeader>
                          <CardTitle className="text-lg flex justify-between items-center">
                            <span>{train.trainType} ({train.trainNo.split('-')[0]})</span>
                            <span className="text-sm font-normal text-gray-500">
                              {train.depTime.slice(0, 2)}:{train.depTime.slice(2)} ~ {train.arrTime.slice(0, 2)}:{train.arrTime.slice(2)}
                            </span>
                          </CardTitle>
                          <CardDescription>
                            {train.depStation} ({train.depTime.slice(0, 2)}:{train.depTime.slice(2)}) → {train.arrStation} ({train.arrTime.slice(0, 2)}:{train.arrTime.slice(2)})
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center text-sm">
                            <span>Fare: <strong>{train.fare.toLocaleString()}원</strong></span>
                            <div className="flex space-x-2">
                              {train.specialSeatAvailable && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">특실 가능</span>
                              )}
                              {train.generalSeatAvailable && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">일반실 가능</span>
                              )}
                              {!train.isAvailable && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">매진</span>
                              )}
                              {train.isAvailable && !train.specialSeatAvailable && !train.generalSeatAvailable && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">좌석 없음</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-4">
                          <Button 
                            className="w-full" 
                            onClick={() => handleSelectTrainForReservation(train)}
                            disabled={!train.isAvailable && !train.specialSeatAvailable && !train.generalSeatAvailable}
                          >
                            {(!train.isAvailable && !train.specialSeatAvailable && !train.generalSeatAvailable) ? '매진 (예약불가)' : '이 열차 예약하기'}
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
                {trainSearchResults && trainSearchResults.length === 0 && (
                  <div className="mt-8 w-full px-4 sm:px-0">
                    <p className="text-center text-gray-500">No trains found for your criteria.</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}