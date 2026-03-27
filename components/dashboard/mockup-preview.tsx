"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MockupPreviewProps {
  productId: number;
  designUrl: string;
  variantIds: number[];
}

interface Placement {
  name: string;
  printfiles: Array<{
    printfile_id: number;
    width: number;
    height: number;
  }>;
}

interface MockupImage {
  placement: string;
  mockup_url: string;
  extra: Array<{ title: string; url: string }>;
}

export function MockupPreview({
  productId,
  designUrl,
  variantIds,
}: MockupPreviewProps) {
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [selectedPlacement, setSelectedPlacement] = useState<string>("front");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mockups, setMockups] = useState<MockupImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Design position adjustments
  const [designWidth, setDesignWidth] = useState(100);
  const [designTop, setDesignTop] = useState(0);
  const [designLeft, setDesignLeft] = useState(0);

  // Load available placements
  useEffect(() => {
    async function loadPlacements() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/printful/mockups?productId=${productId}`
        );
        const data = await res.json();
        if (data.printfiles?.available_placements) {
          setPlacements(data.printfiles.available_placements);
          const placementNames = Object.keys(
            data.printfiles.available_placements
          );
          if (placementNames.length > 0) {
            setSelectedPlacement(
              placementNames.includes("front")
                ? "front"
                : placementNames[0]
            );
          }
        }
      } catch {
        setError("Failed to load mockup options");
      }
      setLoading(false);
    }
    loadPlacements();
  }, [productId]);

  const generateMockup = useCallback(async () => {
    if (!designUrl) return;

    setGenerating(true);
    setError(null);
    setMockups([]);

    try {
      // Get printfile dimensions for position calculation
      const placement = placements[selectedPlacement];
      const printfile = placement?.printfiles?.[0];

      const position = printfile
        ? {
            area_width: printfile.width,
            area_height: printfile.height,
            width: Math.round(printfile.width * (designWidth / 100)),
            height: Math.round(printfile.height * (designWidth / 100)),
            top: Math.round(
              printfile.height * (designTop / 100)
            ),
            left: Math.round(
              printfile.width * (designLeft / 100)
            ),
          }
        : undefined;

      // Create mockup task
      const taskRes = await fetch("/api/printful/mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantIds: variantIds.slice(0, 5), // Limit to 5 variants for speed
          designUrl,
          placement: selectedPlacement,
          position,
        }),
      });

      const taskData = await taskRes.json();
      if (taskData.error) {
        setError(taskData.error);
        setGenerating(false);
        return;
      }

      // Poll for result
      const taskKey = taskData.task_key;
      let attempts = 0;
      const maxAttempts = 30;

      const poll = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          setError("Mockup generation timed out. Try again.");
          setGenerating(false);
          return;
        }

        const resultRes = await fetch(
          `/api/printful/mockups?taskKey=${taskKey}`
        );
        const result = await resultRes.json();

        if (result.status === "completed" && result.mockups) {
          setMockups(result.mockups);
          setGenerating(false);
        } else if (result.status === "failed") {
          setError(result.error || "Mockup generation failed");
          setGenerating(false);
        } else {
          // Still pending — poll again
          setTimeout(poll, 2000);
        }
      };

      setTimeout(poll, 3000); // Initial delay
    } catch {
      setError("Failed to generate mockup");
      setGenerating(false);
    }
  }, [
    designUrl,
    productId,
    variantIds,
    selectedPlacement,
    placements,
    designWidth,
    designTop,
    designLeft,
  ]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mockup Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Loading mockup options...
          </p>
        </CardContent>
      </Card>
    );
  }

  const placementNames = Object.keys(placements);

  if (placementNames.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mockup Preview</CardTitle>
        <CardDescription>
          Visualize how your design will look on the product
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Placement selector */}
        <div className="space-y-2">
          <Label>Print Placement</Label>
          <Select
            value={selectedPlacement}
            onValueChange={(v) => {
              if (v) setSelectedPlacement(v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {placementNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name.charAt(0).toUpperCase() +
                    name.slice(1).replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Design position controls */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Design Size (%)</Label>
            <Input
              type="number"
              min={10}
              max={100}
              value={designWidth}
              onChange={(e) => setDesignWidth(parseInt(e.target.value) || 100)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vertical Offset (%)</Label>
            <Input
              type="number"
              min={-50}
              max={50}
              value={designTop}
              onChange={(e) => setDesignTop(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horizontal Offset (%)</Label>
            <Input
              type="number"
              min={-50}
              max={50}
              value={designLeft}
              onChange={(e) => setDesignLeft(parseInt(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={generateMockup}
          disabled={generating || !designUrl}
        >
          {generating ? "Generating mockups..." : "Generate Mockup Preview"}
        </Button>

        {!designUrl && (
          <p className="text-xs text-muted-foreground">
            Enter a design file URL above to generate mockups
          </p>
        )}

        {/* Mockup results */}
        {mockups.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Generated Mockups</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mockups.map((mockup, i) => (
                <div key={i} className="space-y-2">
                  <img
                    src={mockup.mockup_url}
                    alt={`Mockup ${mockup.placement}`}
                    className="w-full rounded-md border"
                  />
                  <p className="text-xs text-muted-foreground text-center capitalize">
                    {mockup.placement}
                  </p>
                  {/* Extra mockup views */}
                  {mockup.extra?.map((extra, j) => (
                    <div key={j}>
                      <img
                        src={extra.url}
                        alt={extra.title}
                        className="w-full rounded-md border"
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        {extra.title}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
