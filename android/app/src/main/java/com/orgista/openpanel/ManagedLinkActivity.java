package com.orgista.openpanel;

public final class ManagedLinkActivity extends SafeBrowserActivity {
    @Override protected boolean managedLink() { return true; }

    private String initial;
    private boolean checked;

    private String approvedUrl() {
        if (checked) return initial;
        checked = true;
        String url = getIntent() != null ? getIntent().getDataString() : null;
        initial = url != null && (ManagedSettingsFile.containsLink(this, url) || LocalLinks.contains(LocalLinks.load(this), url)) ? url : null;
        return initial;
    }

    @Override protected boolean isAllowed(String url) {
        return ManagedLinkPolicy.isAllowed(approvedUrl(), url);
    }

    @Override protected String initialUrl(String requested) {
        String approved = approvedUrl();
        if (approved == null || !ManagedLinkPolicy.isAllowed(approved, approved)) {
            finish();
            return "about:blank";
        }
        return requested != null && isAllowed(requested) ? requested : approved;
    }
}
