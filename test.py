import os
import zipfile
import pandas as pd
from playwright.sync_api import sync_playwright

def scrape_cms_cpt_codes():
    with sync_playwright() as p:
        # headless=False taake aap browser ko chalta dekh sakein
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        
        try:
            url = "https://www.cms.gov/medicare/regulations-guidance/physician-self-referral/list-cpt-hcpcs-codes"
            print("Page loading...")
            page.goto(url, wait_until="networkidle")

            # Zip file link dhoondna
            link_selector = "a[href*='.zip']"
            page.wait_for_selector(link_selector)
            
            print("Clicking download link...")
            with page.expect_download(timeout=120000) as download_info:
                # Link par click karna
                page.click(link_selector)
                
                # License Accept karna (agar popup aaye)
                # Hum 3 second wait karte hain check karne ke liye
                page.wait_for_timeout(3000) 
                accept_btn = page.get_by_role("button", name="Accept", exact=True)
                
                if accept_btn.is_visible():
                    print("Policy page detected. Clicking 'Accept'...")
                    accept_btn.click()

            download = download_info.value
            file_path = os.path.join(os.getcwd(), download.suggested_filename)
            download.save_as(file_path)
            print(f"Success! File saved at: {file_path}")

            # Zip file ko extract aur read karna
            if zipfile.is_zipfile(file_path):
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    # 'cms_data' folder mein extract karein
                    extract_path = "./cms_data"
                    zip_ref.extractall(extract_path)
                    
                    # Excel file dhoondna (.xlsx ya .xls)
                    excel_files = [f for f in zip_ref.namelist() if f.lower().endswith(('.xlsx', '.xls'))]
                    
                    if excel_files:
                        full_excel_path = os.path.join(extract_path, excel_files[0])
                        df = pd.read_excel(full_excel_path)
                        print("\n--- Data Preview ---")
                        print(df.head())
                    else:
                        print("Zip file ke andar koi Excel file nahi mili.")

        except Exception as e:
            print(f"Error occurred: {e}")
        finally:
            print("Closing browser in 5 seconds...")
            page.wait_for_timeout(5000)
            browser.close()

if __name__ == "__main__":
    scrape_cms_cpt_codes()