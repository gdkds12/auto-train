// web/app/page.tsx
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ArrowRightLeft, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
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
import { TrainSearchResults } from '@/components/common/train-search-results'; // New component

type TrainMode = 'KTX' | 'SRT';

export interface TrainResult {
  trainNo: string;
  trainType: string;
  depTime: string;
  arrTime: string;
  depStation: string;
  arrStation: string;
  isAvailable: boolean; // Indicates if any seat (special or general) is available
  specialSeatAvailable: boolean;
  generalSeatAvailable: boolean;
  fare: number;
  runDate: string; // YYYYMMDD
  trainId: string; // A unique identifier that can be passed to the worker for reservation
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

  const stations = mode === 'KTX' ? KTX_STATIONS : SRT_STATIONS;

  React.useEffect(() => {
    // Reset stations when mode changes
    if (mode === 'KTX') {
      setDepStation({ name: '서울', code: '0001' });
      setArrStation({ name: '부산', code: '0017' }); // Corrected 부산 code for KTX
    } else {
      setDepStation({ name: '수서', code: '0551' });
      setArrStation({ name: '부산', code: '0017' }); // Corrected 부산 code for SRT
    }
    setTrainSearchResults(null); // Clear search results on mode change
  }, [mode]);

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
    setTrainSearchResults(null); // Clear previous results

    try {
      const response = await fetch('/api/trains/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          trainMode: mode,
          depStationCode: depStation.code,
          arrStationCode: arrStation.code,
          date: format(date, 'yyyyMMdd'),
          timeFrom: time.replace(':', '') + '00',
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setTrainSearchResults(results);
        if (results.length === 0) {
            setMessage('No trains found for your criteria.');
        } else {
            setMessage('');
        }
      } else {
        const errorData = await response.json();
        setMessage(`Failed to search trains: ${errorData.message || response.statusText}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle selection of a specific train for reservation
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
          date: format(date, 'yyyyMMdd'), // Use the selected search date
          timeFrom: train.depTime, // Use the train's specific departure time
          selectedTrainNo: train.trainNo,
          selectedTrainType: train.trainType,
          selectedDepTime: train.depTime,
          selectedArrTime: train.arrTime,
          selectedTrainClass: train.generalSeatAvailable ? '일반실' : (train.specialSeatAvailable ? '특실' : null), // Simplified for now
          selectedTrainId: train.trainId, // Unique ID for the train from the library
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`Reservation task created successfully! Task ID: ${result.id}. Worker will now attempt to book.`);
        setTrainSearchResults(null); // Clear search results after initiating reservation
        // TODO: Implement macro progress display here (e.g., redirect to a task status page or show a modal)
      } else {
        const errorData = await response.json();
        setMessage(`Failed to create reservation task: ${errorData.message || response.statusText}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
      <div className="w-full max-w-md p-4 sm:p-0">
        <Tabs value={mode} onValueChange={(value) => setMode(value as TrainMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="KTX">KTX</TabsTrigger>
            <TabsTrigger value="SRT">SRT</TabsTrigger>
          </TabsList>
          <TabsContent value={mode}> {/* Use dynamic mode value */}
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
                  {/* Station Selectors */}
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

                  {/* Date and Time Selectors */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date</Label>
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
                      <Label>Time</Label>
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
                  <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg">
                    {isLoading ? 'Searching...' : 'Search for Tickets'}
                  </Button>
                  {message && (
                    <p className={`text-sm ${message.startsWith('Failed') || message.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                      {message}
                    </p>
                  )}
                </CardFooter>
              </form>
            </Card>

            {trainSearchResults && (
                <div className="mt-8 w-full">
                    <h2 className="text-xl font-bold mb-4 px-4 sm:px-0">Available Trains</h2>
                    <TrainSearchResults 
                        trains={trainSearchResults} 
                        onSelectTrain={handleSelectTrainForReservation}
                        isLoading={isLoading}
                    />
                </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}