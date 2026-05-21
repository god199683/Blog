package com.god199683.blog;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Insets;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.MotionEvent;
import android.view.ViewGroup;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://god199683.github.io/Blog/";
    private FrameLayout rootView;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        rootView = new PullRefreshLayout(this);
        rootView.setBackgroundColor(Color.WHITE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        ((PullRefreshLayout) rootView).setRefreshTarget(webView, () -> webView.reload());
        rootView.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setUserAgentString(settings.getUserAgentString() + " BlogAndroidApp");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new BlogWebViewClient());
        webView.setDownloadListener(createDownloadListener());

        setContentView(rootView);
        applySystemBarInsets(rootView);

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void applySystemBarInsets(View root) {
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.setStatusBarColor(Color.parseColor("#E9F8FF"));
            window.setNavigationBarColor(Color.WHITE);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                int bottomInset = Math.max(bars.bottom, ime.bottom);
                view.setPadding(bars.left, bars.top, bars.right, bottomInset);
                return WindowInsets.CONSUMED;
            });
            root.requestApplyInsets();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private DownloadListener createDownloadListener() {
        return (url, userAgent, contentDisposition, mimetype, contentLength) -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        };
    }

    private static class BlogWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            return openExternalIfNeeded(view, uri);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return openExternalIfNeeded(view, Uri.parse(url));
        }

        private static boolean openExternalIfNeeded(WebView view, Uri uri) {
            String host = uri.getHost();
            if ("god199683.github.io".equalsIgnoreCase(host)) {
                return false;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            view.getContext().startActivity(intent);
            return true;
        }
    }

    private static class PullRefreshLayout extends FrameLayout {
        private final int touchSlop;
        private WebView refreshTarget;
        private Runnable refreshAction;
        private float startY;
        private float startX;
        private boolean pulling;

        PullRefreshLayout(Activity context) {
            super(context);
            touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
        }

        void setRefreshTarget(WebView target, Runnable action) {
            refreshTarget = target;
            refreshAction = action;
        }

        @Override
        public boolean onInterceptTouchEvent(MotionEvent event) {
            if (refreshTarget == null || refreshTarget.getScrollY() > 0) {
                return super.onInterceptTouchEvent(event);
            }

            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    startY = event.getY();
                    startX = event.getX();
                    pulling = false;
                    break;
                case MotionEvent.ACTION_MOVE:
                    float distanceY = event.getY() - startY;
                    float distanceX = Math.abs(event.getX() - startX);
                    if (distanceY > touchSlop * 2 && distanceY > distanceX * 1.35f) {
                        pulling = true;
                        return true;
                    }
                    break;
                default:
                    pulling = false;
                    break;
            }

            return super.onInterceptTouchEvent(event);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            if (!pulling) return super.onTouchEvent(event);

            if (event.getActionMasked() == MotionEvent.ACTION_UP) {
                if (event.getY() - startY > touchSlop * 5 && refreshAction != null) {
                    refreshAction.run();
                }
                pulling = false;
                return true;
            }

            if (event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                pulling = false;
                return true;
            }

            return true;
        }
    }
}
