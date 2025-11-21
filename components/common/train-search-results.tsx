// web/components/common/train-search-results.tsx
'use client';

import * as React from 'react';
import { TrainResult } from '@/app/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, CircleOff } from 'lucide-react';

interface TrainSearchResultsProps {
  trains: TrainResult[];
  onSelectTrain: (train: TrainResult) => void;
  isLoading: boolean;
}

export function TrainSearchResults({ trains, onSelectTrain, isLoading }: TrainSearchResultsProps) {
  return (
    <ScrollArea className="h-[400px] w-full rounded-md border">
      <div className="p-4 space-y-4">
        {trains.length === 0 ? (
          <p className="text-center text-muted-foreground">No trains found for your criteria.</p>
        ) : (
          trains.map((train, index) => (
            <Card key={index} className="flex flex-col sm:flex-row items-center justify-between p-4">
              <div className="flex-1 text-center sm:text-left">
                <CardTitle className="text-lg md:text-xl">
                  {train.trainType} {train.trainNo}
                </CardTitle>
                <CardDescription className="text-sm md:text-base">
                  {train.depStation} ({train.depTime}) → {train.arrStation} ({train.arrTime})
                </CardDescription>
                <div className="flex items-center space-x-2 mt-2">
                  {train.generalSeatAvailable ? (
                    <span className="flex items-center text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> 일반실 가능
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600 text-sm">
                      <CircleOff className="h-4 w-4 mr-1" /> 일반실 매진
                    </span>
                  )}
                  {train.specialSeatAvailable && (
                    <span className="flex items-center text-green-600 text-sm">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> 특실 가능
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 sm:mt-0 sm:ml-4">
                <Button 
                  onClick={() => onSelectTrain(train)} 
                  disabled={isLoading || (!train.generalSeatAvailable && !train.specialSeatAvailable)}
                >
                  {train.isAvailable ? '선택 및 예약' : '매진'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </ScrollArea>
  );
}