use crate::errors::AppResult;
use crate::models::account::Account;
use crate::services::database::DatabaseService;

#[tauri::command]
pub fn get_active_account(
    db: tauri::State<'_, DatabaseService>,
) -> AppResult<Option<Account>> {
    db.get_active_account()
}

#[tauri::command]
pub fn save_account(
    db: tauri::State<'_, DatabaseService>,
    account: Account,
) -> AppResult<()> {
    db.save_account(&account)
}
