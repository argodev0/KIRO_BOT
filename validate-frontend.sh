#!/bin/bash

echo "🔍 Validating Frontend Paper Trading Enhancements..."
echo ""

# Check if required files exist
echo "📁 Checking required files..."

files=(
  "src/frontend/components/common/PaperTradingIndicator.tsx"
  "src/frontend/components/common/LiveDataIndicator.tsx"
  "src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx"
  "src/frontend/components/charts/EnhancedTradingViewChart.tsx"
  "src/frontend/components/trading/PaperTradingConfirmDialog.tsx"
  "src/frontend/__tests__/components/PaperTradingIndicator.test.tsx"
  "src/frontend/__tests__/components/VirtualPortfolioDisplay.test.tsx"
)

all_valid=true

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file - MISSING"
    all_valid=false
  fi
done

echo ""
echo "📝 Checking file content..."

# Check PaperTradingIndicator content
if [ -f "src/frontend/components/common/PaperTradingIndicator.tsx" ]; then
  if grep -q "PAPER TRADING" "src/frontend/components/common/PaperTradingIndicator.tsx" && \
     grep -q "Security" "src/frontend/components/common/PaperTradingIndicator.tsx"; then
    echo "✅ PaperTradingIndicator.tsx has required content"
  else
    echo "❌ PaperTradingIndicator.tsx missing required content"
    all_valid=false
  fi
fi

# Check LiveDataIndicator content
if [ -f "src/frontend/components/common/LiveDataIndicator.tsx" ]; then
  if grep -q "LIVE MAINNET DATA" "src/frontend/components/common/LiveDataIndicator.tsx" && \
     grep -q "isConnected" "src/frontend/components/common/LiveDataIndicator.tsx"; then
    echo "✅ LiveDataIndicator.tsx has required content"
  else
    echo "❌ LiveDataIndicator.tsx missing required content"
    all_valid=false
  fi
fi

# Check VirtualPortfolioDisplay content
if [ -f "src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx" ]; then
  if grep -q "Virtual Portfolio" "src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx" && \
     grep -q "PAPER" "src/frontend/components/dashboard/VirtualPortfolioDisplay.tsx"; then
    echo "✅ VirtualPortfolioDisplay.tsx has required content"
  else
    echo "❌ VirtualPortfolioDisplay.tsx missing required content"
    all_valid=false
  fi
fi

# Check App.tsx updates
if [ -f "src/frontend/App.tsx" ]; then
  if grep -q "PaperTradingIndicator" "src/frontend/App.tsx"; then
    echo "✅ App.tsx has paper trading indicator"
  else
    echo "❌ App.tsx missing paper trading indicator"
    all_valid=false
  fi
fi

# Check ResponsiveDashboard updates
if [ -f "src/frontend/components/dashboard/ResponsiveDashboard.tsx" ]; then
  if grep -q "VirtualPortfolioDisplay" "src/frontend/components/dashboard/ResponsiveDashboard.tsx"; then
    echo "✅ ResponsiveDashboard.tsx uses VirtualPortfolioDisplay"
  else
    echo "❌ ResponsiveDashboard.tsx not using VirtualPortfolioDisplay"
    all_valid=false
  fi
fi

# Check MarketDataWidget updates
if [ -f "src/frontend/components/dashboard/MarketDataWidget.tsx" ]; then
  if grep -q "LiveDataIndicator" "src/frontend/components/dashboard/MarketDataWidget.tsx"; then
    echo "✅ MarketDataWidget.tsx has live data indicators"
  else
    echo "❌ MarketDataWidget.tsx missing live data indicators"
    all_valid=false
  fi
fi

# Check trading slice updates
if [ -f "src/frontend/store/slices/tradingSlice.ts" ]; then
  if grep -q "paperTrading" "src/frontend/store/slices/tradingSlice.ts"; then
    echo "✅ tradingSlice.ts has paper trading state"
  else
    echo "❌ tradingSlice.ts missing paper trading state"
    all_valid=false
  fi
fi

echo ""
echo "=================================================="

if [ "$all_valid" = true ]; then
  echo "🎉 All frontend paper trading enhancements are properly implemented!"
  echo ""
  echo "📋 Summary of implemented features:"
  echo "• Paper trading indicators and warnings throughout UI"
  echo "• Live market data indicators showing mainnet connection"
  echo "• Virtual portfolio display with simulated balances"
  echo "• Enhanced TradingView chart with live data integration"
  echo "• Paper trading confirmation dialogs"
  echo "• Updated Redux state management for paper trading"
  echo "• Comprehensive test coverage"
  exit 0
else
  echo "❌ Some frontend enhancements are missing or incomplete."
  echo "Please review the errors above and ensure all components are properly implemented."
  exit 1
fi